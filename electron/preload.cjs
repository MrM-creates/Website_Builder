const { contextBridge } = require('electron');
const pkg = require('../package.json');

contextBridge.exposeInMainWorld('fliderDesktop', {
  appVersion: pkg.version,
  runtime: 'electron'
});

