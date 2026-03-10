const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FRONTEND_URL = 'http://127.0.0.1:5173/';
const HEALTH_URL = 'http://127.0.0.1:3001/api/system/health';
const BOOT_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 600;

let mainWindow = null;
let stackStartedByDesktop = false;
let desktopRuntime = null;

const ensureDesktopRuntime = () => {
  if (!app.isPackaged) {
    desktopRuntime = null;
    return null;
  }

  const userDataRoot = app.getPath('userData');
  const runtimeRoot = path.join(userDataRoot, 'runtime');
  const stateDir = path.join(runtimeRoot, '.flatsite');
  const kirbyRoot = path.join(runtimeRoot, 'kirby-cms');
  const kirbyTemplateRoot = path.join(PROJECT_ROOT, 'kirby-cms');
  const legacyBundledStateDir = path.join(PROJECT_ROOT, '.flatsite');

  if (!fs.existsSync(kirbyTemplateRoot)) {
    throw new Error(`Kirby-Template fehlt: ${kirbyTemplateRoot}`);
  }

  fs.mkdirSync(runtimeRoot, { recursive: true });

  // First run: create a writable Kirby runtime outside the signed app bundle.
  if (!fs.existsSync(kirbyRoot)) {
    fs.cpSync(kirbyTemplateRoot, kirbyRoot, { recursive: true });
  }

  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(path.join(kirbyRoot, 'content'), { recursive: true });
  fs.mkdirSync(path.join(kirbyRoot, 'assets', 'css'), { recursive: true });
  fs.mkdirSync(path.join(kirbyRoot, 'assets', 'uploads'), { recursive: true });

  // One-time migration from older packaged builds that stored state in the app bundle.
  if (fs.existsSync(legacyBundledStateDir)) {
    for (const name of [
      'projects-history.json',
      'active-project.json',
      'config.json',
      'admin-credentials.json'
    ]) {
      const source = path.join(legacyBundledStateDir, name);
      const target = path.join(stateDir, name);
      if (fs.existsSync(source) && !fs.existsSync(target)) {
        fs.copyFileSync(source, target);
      }
    }
  }

  desktopRuntime = { runtimeRoot, stateDir, kirbyRoot };
  return desktopRuntime;
};

const stackRuntimeEnv = () => {
  const env = { ...process.env };
  if (desktopRuntime) {
    env.FLIDER_RUNTIME_ROOT = desktopRuntime.runtimeRoot;
    env.FLIDER_STATE_DIR = desktopRuntime.stateDir;
    env.FLIDER_KIRBY_ROOT = desktopRuntime.kirbyRoot;
  }
  if (app.isPackaged) {
    env.FLIDER_NODE_BIN = process.execPath;
    env.FLIDER_ELECTRON_RUN_AS_NODE = '1';
  }
  return env;
};

const runCommand = (cmd, args, { stdio = 'pipe', env = process.env } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      stdio,
      shell: false,
      env
    });

    let stderr = '';
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
      });
    }

    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });

const stopStackDetached = () => {
  const child = spawn('bash', [path.join(PROJECT_ROOT, 'scripts', 'dev-bg-stop.sh')], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
    shell: false,
    env: stackRuntimeEnv()
  });
  child.unref();
};

const readJson = (url) =>
  new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const status = Number(res.statusCode || 0);
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status}`));
          return;
        }
        try {
          const text = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3500, () => req.destroy(new Error('timeout')));
  });

const isHealthy = async () => {
  try {
    const payload = await readJson(HEALTH_URL);
    return payload?.success === true;
  } catch {
    return false;
  }
};

const waitForHealthy = async (timeoutMs = BOOT_TIMEOUT_MS) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isHealthy()) return true;
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }
  return false;
};

const ensureStack = async () => {
  if (await isHealthy()) return;

  await runCommand('bash', [path.join(PROJECT_ROOT, 'scripts', 'dev-bg-ensure.sh')], {
    env: stackRuntimeEnv()
  });
  const healthy = await waitForHealthy();
  if (!healthy) {
    throw new Error(
      'Flider konnte den lokalen Stack nicht starten. Bitte pruefe mit "npm run dev:bg:doctor".'
    );
  }
  stackStartedByDesktop = true;
};

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#05070a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(FRONTEND_URL);
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await createMainWindow();
    } catch {
      app.quit();
    }
  }
});

app.on('before-quit', () => {
  if (
    stackStartedByDesktop &&
    (process.env.FLIDER_DESKTOP_STOP_STACK_ON_QUIT === '1' || app.isPackaged)
  ) {
    stopStackDetached();
  }
});

app.whenReady().then(async () => {
  try {
    ensureDesktopRuntime();
    await ensureStack();
    await createMainWindow();
  } catch (error) {
    dialog.showErrorBox(
      'Flider konnte nicht starten',
      `${String(error?.message || error)}\n\nTipp: npm run dev:bg:doctor`
    );
    app.quit();
  }
});
