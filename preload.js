const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('capcutApi', {
  scanProjects: () => ipcRenderer.invoke('projects:scan'),
  extractCaptions: (projectPath, draftFileName) =>
    ipcRenderer.invoke('projects:extract-captions', { projectPath, draftFileName }),
  applyChanges: (projectPath, draftFileName, editorText) =>
    ipcRenderer.invoke('projects:apply-changes', { projectPath, draftFileName, editorText }),
  backupProject: (projectPath) => ipcRenderer.invoke('projects:backup', { projectPath }),
  restoreBackup: (projectPath) => ipcRenderer.invoke('projects:restore-backup', { projectPath }),
  listAnimationPresets: () => ipcRenderer.invoke('projects:list-animation-presets'),
  applyAnimation: (projectPath, draftFileName, presetId) =>
    ipcRenderer.invoke('projects:apply-animation', { projectPath, draftFileName, presetId }),
  exportSrt: (projectPath, draftFileName) =>
    ipcRenderer.invoke('projects:export-srt', { projectPath, draftFileName }),
  imageSync: (projectPath, draftFileName, srtText) =>
    ipcRenderer.invoke('projects:image-sync', { projectPath, draftFileName, srtText })
});
