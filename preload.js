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
  async getDesktopTheme() {
    return ipcRenderer.invoke('desktop-store:get-desktop-theme');
  },
  async getLocales() {
    return ipcRenderer.invoke('desktop-store:get-locales');
  },
  async getAppVersion() {
    return ipcRenderer.invoke('desktop-store:get-app-version');
  },
  async checkForUpdates() {
    return ipcRenderer.invoke('desktop-store:check-for-updates');
  },
  async downloadUpdate() {
    return ipcRenderer.invoke('desktop-store:download-update');
  },
  async installUpdate() {
    return ipcRenderer.invoke('desktop-store:install-update');
  },
  onUpdateProgress(callback) {
    ipcRenderer.removeAllListeners('desktop-store:update-progress');
    ipcRenderer.on('desktop-store:update-progress', (_, percent) => callback(percent));
  },
  async getExchangeRate(currency, date) {
    return ipcRenderer.invoke('desktop-store:get-exchange-rate', currency, date);
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
