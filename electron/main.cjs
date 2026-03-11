const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FRONTEND_URL = 'http://127.0.0.1:5173/';
const HEALTH_URL = 'http://127.0.0.1:3001/api/system/health';
const BOOT_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 600;

let mainWindow = null;
let stackStartedByDesktop = false;
let desktopRuntime = null;
let frontendBootInProgress = false;

const ensurePathFromTemplate = (templatePath, runtimePath, { recursive = false } = {}) => {
  if (fs.existsSync(runtimePath)) return;
  if (!fs.existsSync(templatePath)) return;
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  if (recursive) {
    fs.cpSync(templatePath, runtimePath, { recursive: true });
    return;
  }
  fs.copyFileSync(templatePath, runtimePath);
};

const healKirbyRuntimeFromTemplate = (kirbyTemplateRoot, kirbyRoot) => {
  // Ensure critical Kirby runtime entry points exist.
  // Missing router/bootstrap leads to PHP fatal errors on startup.
  ensurePathFromTemplate(
    path.join(kirbyTemplateRoot, 'index.php'),
    path.join(kirbyRoot, 'index.php')
  );
  ensurePathFromTemplate(
    path.join(kirbyTemplateRoot, 'kirby'),
    path.join(kirbyRoot, 'kirby'),
    { recursive: true }
  );
  ensurePathFromTemplate(
    path.join(kirbyTemplateRoot, 'site', 'config'),
    path.join(kirbyRoot, 'site', 'config'),
    { recursive: true }
  );

  // If the Kirby core folder exists but essential files are missing, copy the core folder again.
  const requiredCoreFiles = [
    path.join(kirbyRoot, 'kirby', 'router.php'),
    path.join(kirbyRoot, 'kirby', 'bootstrap.php'),
    path.join(kirbyRoot, 'index.php'),
  ];
  const missingCore = requiredCoreFiles.some((filePath) => !fs.existsSync(filePath));
  if (missingCore) {
    fs.cpSync(path.join(kirbyTemplateRoot, 'kirby'), path.join(kirbyRoot, 'kirby'), { recursive: true });
    ensurePathFromTemplate(
      path.join(kirbyTemplateRoot, 'index.php'),
      path.join(kirbyRoot, 'index.php')
    );
  }
};

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

  // Self-heal partial runtime copies from older/failed builds.
  healKirbyRuntimeFromTemplate(kirbyTemplateRoot, kirbyRoot);

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

const startStackRecoveryDetached = () => {
  const child = spawn('bash', [path.join(PROJECT_ROOT, 'scripts', 'dev-bg-ensure.sh')], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
    shell: false,
    env: stackRuntimeEnv()
  });
  child.unref();
  return child.pid || null;
};

const nowCompactTimestamp = () => {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
};

const supportReportsDir = () => {
  if (desktopRuntime?.stateDir) {
    return path.join(desktopRuntime.stateDir, 'reports');
  }
  return path.join(PROJECT_ROOT, '.flatsite', 'reports');
};

const supportBundlesDir = () => {
  if (desktopRuntime?.stateDir) {
    return path.join(desktopRuntime.stateDir, 'support-bundles');
  }
  return path.join(PROJECT_ROOT, '.flatsite', 'support-bundles');
};

const runtimePidsDir = () => {
  if (desktopRuntime?.runtimeRoot) {
    return path.join(desktopRuntime.runtimeRoot, '.runtime', 'pids');
  }
  return path.join(PROJECT_ROOT, '.runtime', 'pids');
};

const runtimeStackLogPath = () => {
  if (desktopRuntime?.runtimeRoot) {
    return path.join(desktopRuntime.runtimeRoot, '.runtime', 'logs', 'stack.log');
  }
  return path.join(PROJECT_ROOT, '.runtime', 'logs', 'stack.log');
};

const readFileTail = (filePath, maxBytes = 200000) => {
  try {
    const stat = fs.statSync(filePath);
    const total = Number(stat.size || 0);
    if (total <= 0) return '';
    const bytes = Math.min(total, Math.max(1024, Number(maxBytes || 0)));
    const start = Math.max(0, total - bytes);
    const fd = fs.openSync(filePath, 'r');
    try {
      const buffer = Buffer.alloc(bytes);
      const read = fs.readSync(fd, buffer, 0, bytes, start);
      return buffer.slice(0, read).toString('utf-8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
};

const runtimePidSnapshot = () => {
  const dir = runtimePidsDir();
  const out = {};
  try {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.pid')) continue;
      const filePath = path.join(dir, name);
      const raw = String(fs.readFileSync(filePath, 'utf-8') || '').trim();
      const pid = Number(raw);
      let alive = false;
      if (Number.isInteger(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
          alive = true;
        } catch {
          alive = false;
        }
      }
      out[name] = {
        pid: Number.isInteger(pid) && pid > 0 ? pid : null,
        alive
      };
    }
  } catch {
    return out;
  }
  return out;
};

const writeLocalIssueReport = (payload = {}) => {
  const reportDir = supportReportsDir();
  fs.mkdirSync(reportDir, { recursive: true });

  const reportId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');

  const incident = payload && typeof payload.incident === 'object' ? payload.incident : {};
  const report = {
    schemaVersion: '1.0',
    reportType: 'diagnostic-report',
    reportId,
    timestamp: new Date().toISOString(),
    app: payload?.app || { name: 'Flider', version: 'unknown' },
    environment: payload?.environment || {},
    project: payload?.project || { id: 'unknown', path: PROJECT_ROOT },
    incident: {
      errorCode: String(incident.errorCode || 'SRV_UNHEALTHY'),
      severity: String(incident.severity || 'P1'),
      message: String(incident.message || 'Problem gemeldet'),
      reproSteps: Array.isArray(incident.reproSteps) && incident.reproSteps.length
        ? incident.reproSteps.map((step) => String(step))
        : ['Problem in App gemeldet']
    },
    services: payload?.diagnostics?.health || {},
    recovery: {
      suggestedSteps: Array.isArray(payload?.diagnostics?.recoverySteps)
        ? payload.diagnostics.recoverySteps.map((step) => String(step))
        : [],
      actionsTried: Array.isArray(payload?.diagnostics?.actionsTried)
        ? payload.diagnostics.actionsTried
        : []
    },
    attachments: []
  };

  const filename = `report-${nowCompactTimestamp()}-${String(reportId).slice(0, 8)}.json`;
  const reportPath = path.join(reportDir, filename);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return {
    reportId,
    reportPath,
    summary: `[${report.incident.errorCode}/${report.incident.severity}] ${report.incident.message} (${report.timestamp})`
  };
};

const writeLocalSupportBundle = (payload = {}) => {
  const reportResult = writeLocalIssueReport(payload || {});
  let report = null;
  try {
    report = JSON.parse(fs.readFileSync(reportResult.reportPath, 'utf-8'));
  } catch {
    report = null;
  }

  const bundleDir = supportBundlesDir();
  fs.mkdirSync(bundleDir, { recursive: true });

  const bundleId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  const stackLogPath = runtimeStackLogPath();
  const stackLogTail = readFileTail(stackLogPath, 220000);

  const bundle = {
    schemaVersion: '1.0',
    bundleType: 'support-bundle',
    bundleId,
    createdAt: new Date().toISOString(),
    app: {
      name: 'Flider',
      version: app.getVersion()
    },
    report: report
      ? {
          reportId: String(report.reportId || ''),
          reportPath: reportResult.reportPath,
          errorCode: String(report?.incident?.errorCode || ''),
          severity: String(report?.incident?.severity || ''),
          message: String(report?.incident?.message || '')
        }
      : null,
    diagnostics: payload?.diagnostics || null,
    runtime: {
      runtimeRoot: desktopRuntime?.runtimeRoot || PROJECT_ROOT,
      stateDir: desktopRuntime?.stateDir || path.join(PROJECT_ROOT, '.flatsite'),
      pidSnapshot: runtimePidSnapshot(),
      stackLogPath,
      stackLogTail
    }
  };

  const filename = `support-${nowCompactTimestamp()}-${String(bundleId).slice(0, 8)}.json`;
  const bundlePath = path.join(bundleDir, filename);
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf-8');

  return {
    ...reportResult,
    bundleId,
    bundlePath
  };
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

const BOOT_SCREEN_HTML = `
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flider startet...</title>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #05070a;
        color: #f5f5f5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .wrap {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        text-align: center;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 22px 28px;
        background: rgba(255,255,255,0.04);
      }
      .title {
        font-size: 18px;
        font-weight: 650;
        margin-bottom: 8px;
      }
      .sub {
        font-size: 13px;
        color: rgba(245,245,245,0.75);
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="title">Flider startet ...</div>
        <div class="sub">Lokale Dienste werden vorbereitet.</div>
      </div>
    </div>
  </body>
</html>
`;

const loadBootScreen = async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(BOOT_SCREEN_HTML)}`;
  await mainWindow.loadURL(dataUrl);
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
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await loadBootScreen();
};

const bootFrontend = async () => {
  if (frontendBootInProgress) return;
  frontendBootInProgress = true;

  try {
    await ensureStack();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    await mainWindow.loadURL(FRONTEND_URL);
  } finally {
    frontendBootInProgress = false;
  }
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await createMainWindow();
      await bootFrontend();
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

ipcMain.handle('flider:restart-services', async () => {
  try {
    const pid = startStackRecoveryDetached();
    return {
      success: true,
      message: 'System-Recovery wurde gestartet',
      pid
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || 'System-Recovery konnte nicht gestartet werden')
    };
  }
});

ipcMain.handle('flider:save-issue-report', async (_event, payload) => {
  try {
    const result = writeLocalIssueReport(payload || {});
    return {
      success: true,
      ...result,
      message: 'Problembericht wurde lokal gespeichert'
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || 'Problembericht konnte nicht gespeichert werden')
    };
  }
});

ipcMain.handle('flider:save-support-bundle', async (_event, payload) => {
  try {
    const result = writeLocalSupportBundle(payload || {});
    return {
      success: true,
      ...result,
      message: 'Support-Paket wurde lokal gespeichert'
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || 'Support-Paket konnte nicht gespeichert werden')
    };
  }
});

ipcMain.handle('flider:bridge-status', async () => ({
  success: true,
  isPackaged: Boolean(app.isPackaged),
  runtimeRoot: desktopRuntime?.runtimeRoot || null,
  stateDir: desktopRuntime?.stateDir || null,
  timestamp: new Date().toISOString()
}));

ipcMain.on('flider:get-app-version', (event) => {
  event.returnValue = app.getVersion();
});

app.whenReady().then(async () => {
  try {
    ensureDesktopRuntime();
    await createMainWindow();
    await bootFrontend();
  } catch (error) {
    dialog.showErrorBox(
      'Flider konnte nicht starten',
      `${String(error?.message || error)}\n\nTipp: npm run dev:bg:doctor`
    );
    app.quit();
  }
});
