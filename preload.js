const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopStore', {
  isDesktopApp: true,
  async readState() {
    return ipcRenderer.invoke('desktop-store:read-state');
  },
  async writeState(serializedState) {
    return ipcRenderer.invoke('desktop-store:write-state', serializedState);
  },
  async getStateFilePath() {
    return ipcRenderer.invoke('desktop-store:get-state-file-path');
  },
  async getEncryptionStatus() {
    return ipcRenderer.invoke('desktop-store:get-encryption-status');
  },
  async openReadme() {
    return ipcRenderer.invoke('desktop-store:open-readme');
  },
  async getAppVersion() {
    return ipcRenderer.invoke('desktop-store:get-app-version');
  },
  async checkForUpdates() {
    return ipcRenderer.invoke('desktop-store:check-for-updates');
  },
  async openExternalUrl(url) {
    return ipcRenderer.invoke('desktop-store:open-external-url', url);
  },
  async exportBackup(serializedState) {
    return ipcRenderer.invoke('desktop-store:export-backup', serializedState);
  },
  async importBackup() {
    return ipcRenderer.invoke('desktop-store:import-backup');
  },
});
