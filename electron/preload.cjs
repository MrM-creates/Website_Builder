const { contextBridge, ipcRenderer } = require('electron');
const pkg = require('../package.json');

contextBridge.exposeInMainWorld('fliderDesktop', {
  appVersion: pkg.version,
  runtime: 'electron',
  restartServices: () => ipcRenderer.invoke('flider:restart-services'),
  saveIssueReport: (payload) => ipcRenderer.invoke('flider:save-issue-report', payload)
});
