import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, '.runtime');
const logDir = path.join(runtimeDir, 'logs');
const pidDir = path.join(runtimeDir, 'pids');
const stackPidFile = path.join(pidDir, 'stack.pid');
const stackLogFile = path.join(logDir, 'stack.log');

fs.mkdirSync(logDir, { recursive: true });
fs.mkdirSync(pidDir, { recursive: true });

const out = fs.openSync(stackLogFile, 'a');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(npmCommand, ['run', 'dev:stack'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', out, out],
  env: {
    ...process.env,
    FORCE_COLOR: '1'
  }
});

child.unref();
fs.writeFileSync(stackPidFile, `${child.pid}${os.EOL}`, 'utf8');

console.log(child.pid);
