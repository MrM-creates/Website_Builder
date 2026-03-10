const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FRONTEND_URL = 'http://127.0.0.1:5173/';
const HEALTH_URL = 'http://127.0.0.1:3001/api/system/health';
const BOOT_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 600;

let mainWindow = null;
let stackStartedByDesktop = false;

const npmCommand = () => (process.platform === 'win32' ? 'npm.cmd' : 'npm');

const runCommand = (cmd, args, { stdio = 'pipe' } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      stdio,
      shell: false,
      env: process.env
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
  const child = spawn(npmCommand(), ['run', 'dev:bg:stop'], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
    shell: false,
    env: process.env
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

  await runCommand(npmCommand(), ['run', 'dev:bg:ensure']);
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
  if (stackStartedByDesktop && process.env.FLIDER_DESKTOP_STOP_STACK_ON_QUIT === '1') {
    stopStackDetached();
  }
});

app.whenReady().then(async () => {
  try {
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

