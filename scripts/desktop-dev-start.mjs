#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const electronAppPath = path.join(
  projectRoot,
  'node_modules',
  'electron',
  'dist',
  'Electron.app'
);
const electronCliPath = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

const fail = (message) => {
  console.error(`desktop:dev failed: ${message}`);
  process.exit(1);
};

if (process.platform === 'darwin') {
  if (!fs.existsSync(electronAppPath)) {
    fail(`Electron.app nicht gefunden: ${electronAppPath}`);
  }

  // Start via LaunchServices to avoid early AppKit registration aborts.
  const child = spawn('open', ['-na', electronAppPath, '--args', projectRoot], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
    shell: false
  });

  child.on('error', (error) => fail(error?.message || String(error)));
  child.on('close', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
} else {
  if (!fs.existsSync(electronCliPath)) {
    fail(`Electron CLI nicht gefunden: ${electronCliPath}`);
  }

  const child = spawn(electronCliPath, ['.'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
    shell: false
  });

  child.on('error', (error) => fail(error?.message || String(error)));
  child.on('close', (code) => process.exit(code ?? 0));
}

