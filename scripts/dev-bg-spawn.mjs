import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const runtimeRoot = String(process.env.FLIDER_RUNTIME_ROOT || '').trim()
  ? path.resolve(String(process.env.FLIDER_RUNTIME_ROOT || '').trim())
  : root;
const runtimeDir = path.join(runtimeRoot, '.runtime');
const logDir = path.join(runtimeDir, 'logs');
const pidDir = path.join(runtimeDir, 'pids');
const stackPidFile = path.join(pidDir, 'stack.pid');
const stackLogFile = path.join(logDir, 'stack.log');
const backendPidFile = path.join(pidDir, 'backend.pid');
const frontendPidFile = path.join(pidDir, 'frontend.pid');
const kirbyPidFile = path.join(pidDir, 'kirby.pid');

fs.mkdirSync(logDir, { recursive: true });
fs.mkdirSync(pidDir, { recursive: true });

const out = fs.openSync(stackLogFile, 'a');
const nodeCommand = process.env.FLIDER_NODE_BIN || 'node';
const shouldRunAsNode = process.env.FLIDER_ELECTRON_RUN_AS_NODE === '1';

const withNodeEnv = (baseEnv = {}) => {
  const env = { ...baseEnv };
  if (shouldRunAsNode) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }
  return env;
};

const spawnDetached = (cmd, args, env = process.env) => {
  const child = spawn(cmd, args, {
    cwd: root,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...env,
      FORCE_COLOR: '1'
    }
  });
  child.unref();
  return child;
};

const backendChild = spawnDetached(
  nodeCommand,
  [path.join(root, 'server.js')],
  withNodeEnv(process.env)
);

const frontendChild = spawnDetached(
  nodeCommand,
  [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--strictPort'],
  withNodeEnv(process.env)
);

const kirbyShell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
const kirbyArgs =
  process.platform === 'win32'
    ? ['/c', path.join('scripts', 'run-kirby-dev.sh')]
    : [path.join(root, 'scripts', 'run-kirby-dev.sh')];

const kirbyChild = spawnDetached(kirbyShell, kirbyArgs, process.env);

fs.writeFileSync(stackPidFile, `${backendChild.pid}${os.EOL}`, 'utf8');
fs.writeFileSync(backendPidFile, `${backendChild.pid}${os.EOL}`, 'utf8');
fs.writeFileSync(frontendPidFile, `${frontendChild.pid}${os.EOL}`, 'utf8');
fs.writeFileSync(kirbyPidFile, `${kirbyChild.pid}${os.EOL}`, 'utf8');

console.log(`${backendChild.pid}`);
