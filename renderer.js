const elements = {
  refreshProjectsBtn: document.getElementById('refreshProjectsBtn'),
  extractCaptionsBtn: document.getElementById('extractCaptionsBtn'),
  applyChangesBtn: document.getElementById('applyChangesBtn'),
  backupProjectBtn: document.getElementById('backupProjectBtn'),
  restoreBackupBtn: document.getElementById('restoreBackupBtn'),
  downloadTxtBtn: document.getElementById('downloadTxtBtn'),
  uploadTxtInput: document.getElementById('uploadTxtInput'),
  uploadTxtLabel: document.getElementById('uploadTxtLabel'),
  animationPreset: document.getElementById('animationPreset'),
  applyAnimationBtn: document.getElementById('applyAnimationBtn'),
  exportSrtBtn: document.getElementById('exportSrtBtn'),
  syncEditor: document.getElementById('syncEditor'),
  syncUploadInput: document.getElementById('syncUploadInput'),
  syncUploadLabel: document.getElementById('syncUploadLabel'),
  applyImageSyncBtn: document.getElementById('applyImageSyncBtn'),
  projectList: document.getElementById('projectList'),
  projectCount: document.getElementById('projectCount'),
  scanInfo: document.getElementById('scanInfo'),
  selectedProjectName: document.getElementById('selectedProjectName'),
  selectedProjectPath: document.getElementById('selectedProjectPath'),
  captionEditor: document.getElementById('captionEditor'),
  captionCount: document.getElementById('captionCount'),
  backupStatus: document.getElementById('backupStatus'),
  statusBar: document.getElementById('statusBar')
};

const state = {
  projects: [],
  selectedProject: null,
  extractedCaptionCount: 0,
  hasLoadedCaptions: false
};

function setStatus(message, type = 'info') {
  // Mirror every status change to the DevTools console (open with Ctrl+Shift+I).
  const sink = type === 'error' ? console.error : type === 'warning' ? console.warn : console.log;
  sink(`[ui:${type}] ${message}`);
  elements.statusBar.textContent = message;
  elements.statusBar.className = `status-bar ${type}`;
}

function setFileButtonsEnabled(isEnabled) {
  elements.downloadTxtBtn.disabled = !isEnabled;
  if (isEnabled) {
    elements.uploadTxtInput.disabled = false;
    elements.uploadTxtLabel.classList.remove('disabled-label');
  } else {
    elements.uploadTxtInput.disabled = true;
    elements.uploadTxtLabel.classList.add('disabled-label');
  }
}

function setButtonsDisabled(isDisabled) {
  elements.extractCaptionsBtn.disabled = isDisabled;
  elements.backupProjectBtn.disabled = isDisabled;
  elements.restoreBackupBtn.disabled = isDisabled;
  elements.applyChangesBtn.disabled = isDisabled || !state.hasLoadedCaptions;

  // Motion / SRT / Image Sync only require a selected project.
  elements.animationPreset.disabled = isDisabled;
  elements.applyAnimationBtn.disabled = isDisabled;
  elements.exportSrtBtn.disabled = isDisabled;
  updateSyncControls(isDisabled);
}

function updateSyncControls(isDisabled) {
  const projectDisabled = isDisabled || !state.selectedProject;

  if (projectDisabled) {
    elements.syncUploadInput.disabled = true;
    elements.syncUploadLabel.classList.add('disabled-label');
  } else {
    elements.syncUploadInput.disabled = false;
    elements.syncUploadLabel.classList.remove('disabled-label');
  }

  elements.applyImageSyncBtn.disabled = projectDisabled || !elements.syncEditor.value.trim();
}

async function populatePresets() {
  try {
    const presets = await window.capcutApi.listAnimationPresets();
    console.log(`[ui] loaded ${presets.length} animation presets:`, presets.map((p) => p.id).join(', '));
    elements.animationPreset.innerHTML = '';
    presets.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.label;
      elements.animationPreset.appendChild(option);
    });
  } catch (_error) {
    // Leave the dropdown empty; applying will surface a clear error if used.
  }
}

function resetEditor() {
  elements.captionEditor.value = '';
  elements.captionCount.textContent = '0 captions';
  state.extractedCaptionCount = 0;
  state.hasLoadedCaptions = false;
  elements.applyChangesBtn.disabled = true;
  setFileButtonsEnabled(false);
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch (_error) {
    return 'Unknown';
  }
}

function updateSelection(project) {
  state.selectedProject = project;

  if (!project) {
    elements.selectedProjectName.textContent = 'None selected';
    elements.selectedProjectPath.textContent = 'Choose a project from the left panel.';
    setButtonsDisabled(true);
    resetEditor();
    renderProjects();
    return;
  }

  elements.selectedProjectName.textContent = project.name;
  elements.selectedProjectPath.textContent = `${project.path} • ${project.draftFileName}`;
  setButtonsDisabled(false);
  resetEditor();
  renderProjects();
}

function renderProjects() {
  elements.projectCount.textContent = `${state.projects.length} project${state.projects.length === 1 ? '' : 's'}`;
  elements.projectList.innerHTML = '';

  if (!state.projects.length) {
    elements.projectList.innerHTML = '<div class="empty-state">No CapCut projects were found in the default scan locations.</div>';
    return;
  }

  state.projects.forEach((project) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `project-card ${state.selectedProject?.path === project.path ? 'selected' : ''}`;
    button.innerHTML = `
      <span class="project-name">${escapeHtml(project.name)}</span>
      <div class="project-path">${escapeHtml(project.path)}</div>
      <div class="project-meta-line">${project.draftFileName} • Updated ${escapeHtml(formatDate(project.lastModified))}</div>
      <div class="project-meta-line">${project.backupCount} backup${project.backupCount === 1 ? '' : 's'}</div>
    `;

    button.addEventListener('click', () => updateSelection(project));
    elements.projectList.appendChild(button);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function refreshProjects() {
  setStatus('Scanning CapCut project folders...', 'info');
  elements.scanInfo.textContent = 'Scanning default CapCut locations';

  try {
    const projects = await window.capcutApi.scanProjects();
    state.projects = projects;
    renderProjects();

    if (state.selectedProject) {
      const refreshedSelection = projects.find((project) => project.path === state.selectedProject.path);
      updateSelection(refreshedSelection || null);
    }

    if (!projects.length) {
      setStatus('No CapCut projects found. Make sure CapCut has local desktop projects in the default folders.', 'warning');
      return;
    }

    setStatus(`Found ${projects.length} CapCut project${projects.length === 1 ? '' : 's'}.`, 'success');
  } catch (error) {
    setStatus(error.message || 'Failed to scan CapCut projects.', 'error');
  }
}

async function extractCaptions() {
  if (!state.selectedProject) {
    return;
  }

  setStatus('Reading caption text from the selected project...', 'info');

  try {
    const result = await window.capcutApi.extractCaptions(
      state.selectedProject.path,
      state.selectedProject.draftFileName
    );

    elements.captionEditor.value = result.editorText;
    elements.captionCount.textContent = `${result.captionCount} caption${result.captionCount === 1 ? '' : 's'}`;
    state.extractedCaptionCount = result.captionCount;
    state.hasLoadedCaptions = true;
    elements.applyChangesBtn.disabled = false;
    setFileButtonsEnabled(true);

    if (result.hadEmbeddedNewlines) {
      setStatus('Captions extracted. Some embedded line breaks were flattened to spaces for line-by-line editing.', 'warning');
    } else {
      setStatus(`Extracted ${result.captionCount} caption${result.captionCount === 1 ? '' : 's'}.`, 'success');
    }
  } catch (error) {
    state.hasLoadedCaptions = false;
    elements.applyChangesBtn.disabled = true;
    setStatus(error.message || 'Failed to extract captions.', 'error');
  }
}

async function applyChanges() {
  if (!state.selectedProject || !state.hasLoadedCaptions) {
    return;
  }

  setStatus('Creating backup and writing edited captions back to the project...', 'info');

  try {
    const result = await window.capcutApi.applyChanges(
      state.selectedProject.path,
      state.selectedProject.draftFileName,
      elements.captionEditor.value
    );

    elements.backupStatus.textContent = `Latest backup: ${result.backupId}`;
    setStatus(`Saved ${result.updatedCaptionCount} caption${result.updatedCaptionCount === 1 ? '' : 's'} to ${result.draftFileName}.`, 'success');
    await refreshProjects();
  } catch (error) {
    setStatus(error.message || 'Failed to apply caption changes.', 'error');
  }
}

async function backupProject() {
  if (!state.selectedProject) {
    return;
  }

  setStatus('Creating full project backup...', 'info');

  try {
    const result = await window.capcutApi.backupProject(state.selectedProject.path);
    elements.backupStatus.textContent = `Latest backup: ${result.backupId}`;
    setStatus(`Backup created: ${result.backupId}`, 'success');
    await refreshProjects();
  } catch (error) {
    setStatus(error.message || 'Failed to create backup.', 'error');
  }
}

async function restoreBackup() {
  if (!state.selectedProject) {
    return;
  }

  setStatus('Restoring latest backup...', 'info');

  try {
    const result = await window.capcutApi.restoreBackup(state.selectedProject.path);

    if (result?.cancelled) {
      setStatus('Restore cancelled.', 'info');
      return;
    }

    elements.backupStatus.textContent = `Restored backup: ${result.restoredBackupId}`;
    setStatus(`Project restored from backup ${result.restoredBackupId}.`, 'success');
    await refreshProjects();
    await extractCaptions();
  } catch (error) {
    setStatus(error.message || 'Failed to restore backup.', 'error');
  }
}

function downloadCaptions() {
  const text = elements.captionEditor.value;
  if (!text.trim()) {
    setStatus('Nothing to download — extract captions first.', 'warning');
    return;
  }

  const projectName = state.selectedProject?.name || 'captions';
  const safeName = projectName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${safeName}_captions.txt`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  setStatus(`Downloaded ${filename}.`, 'success');
}

function uploadCaptions(event) {
  const file = event.target.files?.[0];
  // Reset input so the same file can be re-selected if needed
  event.target.value = '';

  if (!file) return;

  if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
    setStatus('Please upload a plain .txt file.', 'error');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    // Strip a trailing blank line that many editors append
    const trimmedLines = lines[lines.length - 1].trim() === '' ? lines.slice(0, -1) : lines;

    if (state.hasLoadedCaptions && trimmedLines.length !== state.extractedCaptionCount) {
      setStatus(
        `Line count mismatch: file has ${trimmedLines.length} line${trimmedLines.length === 1 ? '' : 's'} but project has ${state.extractedCaptionCount} caption${state.extractedCaptionCount === 1 ? '' : 's'}. Edit was not applied.`,
        'error'
      );
      return;
    }

    elements.captionEditor.value = trimmedLines.join('\n');
    elements.captionCount.textContent = `${trimmedLines.length} caption${trimmedLines.length === 1 ? '' : 's'}`;
    state.extractedCaptionCount = trimmedLines.length;
    state.hasLoadedCaptions = true;
    elements.applyChangesBtn.disabled = false;
    setStatus(`Loaded ${trimmedLines.length} caption${trimmedLines.length === 1 ? '' : 's'} from ${file.name}. Review and click Apply Changes.`, 'success');
  };

  reader.onerror = () => {
    setStatus('Failed to read the uploaded file.', 'error');
  };

  reader.readAsText(file, 'utf-8');
}

async function applyAnimation() {
  if (!state.selectedProject) {
    return;
  }

  const presetId = elements.animationPreset.value;
  if (!presetId) {
    setStatus('Select an animation preset first.', 'warning');
    return;
  }

  console.log(`[ui] applyAnimation → preset="${presetId}" project="${state.selectedProject.path}"`);
  setStatus('Creating backup and applying animation to all clips...', 'info');

  try {
    const result = await window.capcutApi.applyAnimation(
      state.selectedProject.path,
      state.selectedProject.draftFileName,
      presetId
    );

    console.log('[ui] applyAnimation result:', result);
    elements.backupStatus.textContent = `Latest backup: ${result.backupId}`;
    setStatus(`Animated ${result.animatedCount} clip${result.animatedCount === 1 ? '' : 's'}. Reopen the project in CapCut to see the motion.`, 'success');
    await refreshProjects();
  } catch (error) {
    setStatus(error.message || 'Failed to apply animation.', 'error');
  }
}

async function exportSrt() {
  if (!state.selectedProject) {
    return;
  }

  setStatus('Reading subtitle timings and building .srt...', 'info');

  try {
    const result = await window.capcutApi.exportSrt(
      state.selectedProject.path,
      state.selectedProject.draftFileName
    );

    console.log(`[ui] exportSrt → ${result.cueCount} cues`);
    const safeName = (state.selectedProject.name || 'subtitles').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${safeName}.srt`;

    const blob = new Blob([result.srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);

    setStatus(`Exported ${result.cueCount} subtitle${result.cueCount === 1 ? '' : 's'} to ${filename}.`, 'success');
  } catch (error) {
    setStatus(error.message || 'Failed to export subtitles.', 'error');
  }
}

async function applyImageSync() {
  if (!state.selectedProject) {
    return;
  }

  const srtText = elements.syncEditor.value;
  if (!srtText.trim()) {
    setStatus('Paste SRT text or upload a .srt file first.', 'warning');
    return;
  }

  console.log(`[ui] applyImageSync → ${srtText.length} chars of SRT for "${state.selectedProject.path}"`);
  setStatus('Creating backup and syncing clip durations to subtitle blocks...', 'info');

  try {
    const result = await window.capcutApi.imageSync(
      state.selectedProject.path,
      state.selectedProject.draftFileName,
      srtText
    );

    console.log('[ui] applyImageSync result:', result);
    elements.backupStatus.textContent = `Latest backup: ${result.backupId}`;

    if (result.cueCount !== result.clipCount) {
      setStatus(
        `Synced ${result.syncedCount} clip${result.syncedCount === 1 ? '' : 's'}. Note: ${result.cueCount} subtitle block${result.cueCount === 1 ? '' : 's'} vs ${result.clipCount} clip${result.clipCount === 1 ? '' : 's'} — extras were left in sequence.`,
        'warning'
      );
    } else {
      setStatus(`Synced ${result.syncedCount} clip${result.syncedCount === 1 ? '' : 's'} to the subtitle timing.`, 'success');
    }

    await refreshProjects();
  } catch (error) {
    setStatus(error.message || 'Failed to sync images with subtitles.', 'error');
  }
}

function uploadSrtFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';

  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.srt') && file.type !== 'text/plain') {
    setStatus('Please upload a .srt file.', 'error');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    elements.syncEditor.value = e.target.result;
    updateSyncControls(false);
    setStatus(`Loaded ${file.name}. Review the timing, then click Apply Image Sync.`, 'success');
  };

  reader.onerror = () => {
    setStatus('Failed to read the .srt file.', 'error');
  };

  reader.readAsText(file, 'utf-8');
}

elements.refreshProjectsBtn.addEventListener('click', refreshProjects);
elements.extractCaptionsBtn.addEventListener('click', extractCaptions);
elements.applyChangesBtn.addEventListener('click', applyChanges);
elements.backupProjectBtn.addEventListener('click', backupProject);
elements.restoreBackupBtn.addEventListener('click', restoreBackup);
elements.downloadTxtBtn.addEventListener('click', downloadCaptions);
elements.uploadTxtInput.addEventListener('change', uploadCaptions);
elements.applyAnimationBtn.addEventListener('click', applyAnimation);
elements.exportSrtBtn.addEventListener('click', exportSrt);
elements.applyImageSyncBtn.addEventListener('click', applyImageSync);
elements.syncUploadInput.addEventListener('change', uploadSrtFile);
elements.syncEditor.addEventListener('input', () => updateSyncControls(false));

populatePresets();
refreshProjects();
