const { contextBridge, ipcRenderer } = require('electron');

let appVersion = 'unknown';
try {
  appVersion = String(ipcRenderer.sendSync('flider:get-app-version') || 'unknown');
} catch {
  appVersion = 'unknown';
}

try {
  contextBridge.exposeInMainWorld('fliderDesktop', {
    appVersion,
    runtime: 'electron',
    restartServices: () => ipcRenderer.invoke('flider:restart-services'),
    saveIssueReport: (payload) => ipcRenderer.invoke('flider:save-issue-report', payload),
    saveSupportBundle: (payload) => ipcRenderer.invoke('flider:save-support-bundle', payload),
    bridgeStatus: () => ipcRenderer.invoke('flider:bridge-status')
  });
} catch {
  // Preload must never crash startup.
}
