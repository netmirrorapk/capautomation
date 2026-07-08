const fs = require('fs/promises');
const { existsSync } = require('fs');
const os = require('os');
const path = require('path');
const animationPresets = require('./animation-presets');
const { parseSrt, formatSrt } = require('./srt');

const DRAFT_FILE_CANDIDATES = ['draft_content.json', 'draft_info.json'];
const META_FILE_CANDIDATES = ['draft_meta_info.json', 'draft_meta_info.json'];

function getDefaultProjectRoots() {
  const roots = [];

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    roots.push(path.join(localAppData, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft'));
  }

  if (process.platform === 'darwin') {
    roots.push(path.join(os.homedir(), 'Movies', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft'));
  }

  return roots;
}

async function safeReadDir(targetPath) {
  try {
    return await fs.readdir(targetPath, { withFileTypes: true });
  } catch (_error) {
    return [];
  }
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_error) {
    return false;
  }
}

function createBackupId() {
  return new Date().toISOString().replace(/[.:]/g, '-');
}

function sanitizeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function readJson(targetPath) {
  const raw = await fs.readFile(targetPath, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.basename(targetPath)}: ${error.message}`);
  }
}

async function resolveDraftFile(projectPath, preferredDraftFileName) {
  if (preferredDraftFileName) {
    const candidate = path.join(projectPath, preferredDraftFileName);

    if (await fileExists(candidate)) {
      return {
        draftFileName: preferredDraftFileName,
        draftFilePath: candidate
      };
    }
  }

  for (const draftFileName of DRAFT_FILE_CANDIDATES) {
    const candidate = path.join(projectPath, draftFileName);

    if (await fileExists(candidate)) {
      return {
        draftFileName,
        draftFilePath: candidate
      };
    }
  }

  throw new Error('No CapCut draft JSON file was found in the selected project folder.');
}

async function getProjectDisplayName(projectPath) {
  for (const metaFileName of META_FILE_CANDIDATES) {
    const metaPath = path.join(projectPath, metaFileName);

    if (!(await fileExists(metaPath))) {
      continue;
    }

    try {
      const data = await readJson(metaPath);
      const candidate = data.draft_name || data.project_name || data.name || data.title;

      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    } catch (_error) {
      // Ignore invalid metadata and fall back to folder name.
    }
  }

  return path.basename(projectPath);
}

async function countProjectBackups(projectPath, backupRoot) {
  const backupBase = path.join(backupRoot, sanitizeSegment(path.basename(projectPath)));

  if (!existsSync(backupBase)) {
    return 0;
  }

  const items = await safeReadDir(backupBase);
  return items.filter((item) => item.isDirectory()).length;
}

function parseTextItemContent(textItem) {
  const raw = textItem?.content;
  if (typeof raw !== 'string') return null;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.text === 'string') return parsed;
  } catch (_error) {
    // Not valid JSON — not a subtitle entry we can handle.
  }

  return null;
}

function extractCaptionReferences(projectJson) {
  const texts = projectJson?.materials?.texts;

  if (!Array.isArray(texts)) {
    throw new Error('This CapCut project does not contain materials.texts[].');
  }

  const references = [];

  texts.forEach((textItem, index) => {
    const parsedContent = parseTextItemContent(textItem);
    if (parsedContent !== null) {
      references.push({
        index,
        ref: textItem,
        parsedContent
      });
    }
  });

  if (!references.length) {
    throw new Error('No subtitle text entries were found in materials.texts[].content.text.');
  }

  return references;
}

function normalizeCaptionForLineEditor(value) {
  return value.replace(/\r?\n/g, ' ').trimEnd();
}

function splitEditorText(editorText) {
  return editorText.replace(/\r\n/g, '\n').split('\n');
}

async function scanProjects({ backupRoot }) {
  const projectRoots = getDefaultProjectRoots();
  const projects = [];

  for (const root of projectRoots) {
    if (!existsSync(root)) {
      continue;
    }

    const entries = await safeReadDir(root);

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const projectPath = path.join(root, entry.name);

      try {
        const { draftFileName } = await resolveDraftFile(projectPath);
        const stats = await fs.stat(projectPath);
        const name = await getProjectDisplayName(projectPath);
        const backupCount = await countProjectBackups(projectPath, backupRoot);

        projects.push({
          id: entry.name,
          name,
          path: projectPath,
          draftFileName,
          lastModified: stats.mtime.toISOString(),
          backupCount
        });
      } catch (_error) {
        // Skip folders that are not CapCut projects.
      }
    }
  }

  projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  return projects;
}

async function extractCaptions({ projectPath, draftFileName }) {
  const { draftFilePath, draftFileName: resolvedDraftFileName } = await resolveDraftFile(projectPath, draftFileName);
  const projectJson = await readJson(draftFilePath);
  const references = extractCaptionReferences(projectJson);

  let hadEmbeddedNewlines = false;
  const editorLines = references.map(({ parsedContent }) => {
    const originalText = parsedContent.text;
    if (/\r?\n/.test(originalText)) {
      hadEmbeddedNewlines = true;
    }
    return normalizeCaptionForLineEditor(originalText);
  });

  return {
    draftFileName: resolvedDraftFileName,
    captionCount: references.length,
    editorText: editorLines.join('\n'),
    hadEmbeddedNewlines
  };
}

async function createProjectBackup({ projectPath, backupRoot, backupLabel }) {
  const backupId = backupLabel || createBackupId();
  const backupBase = path.join(backupRoot, sanitizeSegment(path.basename(projectPath)), backupId);
  const backupProjectPath = path.join(backupBase, 'project');

  await fs.mkdir(backupBase, { recursive: true });
  await fs.cp(projectPath, backupProjectPath, {
    recursive: true,
    force: true,
    errorOnExist: false
  });

  console.log(`[service] backup created "${backupId}" → ${backupProjectPath}`);

  return {
    backupId,
    backupPath: backupProjectPath
  };
}

async function writeJsonAtomically(targetPath, content) {
  const tempPath = `${targetPath}.tmp`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, targetPath);
}

async function applyCaptionChanges({ projectPath, draftFileName, editorText, backupRoot }) {
  const { draftFilePath, draftFileName: resolvedDraftFileName } = await resolveDraftFile(projectPath, draftFileName);
  const projectJson = await readJson(draftFilePath);
  const references = extractCaptionReferences(projectJson);
  const newLines = splitEditorText(editorText);

  if (newLines.length !== references.length) {
    throw new Error(`Line count mismatch. Expected ${references.length} caption lines, but received ${newLines.length}.`);
  }

  const backup = await createProjectBackup({ projectPath, backupRoot });

  references.forEach(({ ref, parsedContent }, index) => {
    parsedContent.text = newLines[index];
    ref.content = JSON.stringify(parsedContent);
  });

  await writeJsonAtomically(draftFilePath, `${JSON.stringify(projectJson, null, 2)}\n`);

  return {
    backupId: backup.backupId,
    draftFileName: resolvedDraftFileName,
    updatedCaptionCount: references.length
  };
}

// ---------------------------------------------------------------------------
// Visual clip helpers (images + video clips) — used by the animation and
// image-sync features. Images are stored as materials.videos[] with type
// "photo"; real footage uses type "video".
// ---------------------------------------------------------------------------

function buildVideoMaterialMap(projectJson) {
  const map = new Map();
  const videos = projectJson?.materials?.videos;

  if (Array.isArray(videos)) {
    for (const material of videos) {
      if (material && typeof material.id === 'string') {
        map.set(material.id, material);
      }
    }
  }

  return map;
}

function isVisualMaterial(material) {
  return Boolean(material) && (material.type === 'photo' || material.type === 'video');
}

function collectVisualSegments(projectJson) {
  const materialMap = buildVideoMaterialMap(projectJson);
  const tracks = Array.isArray(projectJson?.tracks) ? projectJson.tracks : [];
  const collected = [];

  for (const track of tracks) {
    if (track?.type !== 'video') {
      continue;
    }

    const segments = Array.isArray(track.segments) ? track.segments : [];

    for (const segment of segments) {
      const material = materialMap.get(segment?.material_id);
      if (isVisualMaterial(material)) {
        collected.push({ segment, material, track });
      }
    }
  }

  return collected;
}

function buildTextMaterialMap(projectJson) {
  const map = new Map();
  const texts = projectJson?.materials?.texts;

  if (Array.isArray(texts)) {
    for (const material of texts) {
      if (material && typeof material.id === 'string') {
        map.set(material.id, material);
      }
    }
  }

  return map;
}

// Apply a Ken Burns / animation preset to every image and video clip on the
// project's video tracks. Existing scale/position keyframes are overwritten;
// keyframes for unrelated properties (alpha, rotation, volume) are preserved.
async function applyAnimationPreset({ projectPath, draftFileName, presetId, backupRoot }) {
  const { draftFilePath, draftFileName: resolvedDraftFileName } = await resolveDraftFile(projectPath, draftFileName);
  const projectJson = await readJson(draftFilePath);
  const visualSegments = collectVisualSegments(projectJson);

  console.log(`[service] applyAnimationPreset preset="${presetId}" — ${visualSegments.length} visual clip(s) found`);

  if (!visualSegments.length) {
    throw new Error('No image or video clips were found on the video tracks of this project.');
  }

  const backup = await createProjectBackup({ projectPath, backupRoot });

  let animatedCount = 0;

  for (const { segment } of visualSegments) {
    const durationUs = segment?.target_timerange?.duration;
    if (!(durationUs > 0)) {
      continue;
    }

    // animatedCount doubles as the cycle index so "Cycle" alternates per clip.
    const preset = animationPresets.buildPresetForIndex(presetId, animatedCount, durationUs);

    if (!segment.clip) {
      segment.clip = {};
    }
    segment.clip.scale = { x: preset.scale.x, y: preset.scale.y };
    segment.clip.transform = { x: preset.transform.x, y: preset.transform.y };

    const preserved = (Array.isArray(segment.common_keyframes) ? segment.common_keyframes : []).filter(
      (channel) => !/Position|Scale/i.test(channel?.property_type || '')
    );
    segment.common_keyframes = [...preserved, ...preset.keyframes];

    animatedCount += 1;
  }

  if (!animatedCount) {
    throw new Error('No clips had a valid duration to animate.');
  }

  await writeJsonAtomically(draftFilePath, `${JSON.stringify(projectJson, null, 2)}\n`);

  console.log(`[service] applyAnimationPreset done — animated ${animatedCount} clip(s)`);

  return {
    backupId: backup.backupId,
    draftFileName: resolvedDraftFileName,
    animatedCount
  };
}

// Read CapCut's subtitle (text) track and export it as a timestamped .srt.
// This is read-only and does not modify the project.
async function exportSrt({ projectPath, draftFileName }) {
  const { draftFilePath, draftFileName: resolvedDraftFileName } = await resolveDraftFile(projectPath, draftFileName);
  const projectJson = await readJson(draftFilePath);
  const textMap = buildTextMaterialMap(projectJson);
  const tracks = Array.isArray(projectJson?.tracks) ? projectJson.tracks : [];
  const cues = [];

  for (const track of tracks) {
    if (track?.type !== 'text') {
      continue;
    }

    for (const segment of track.segments || []) {
      const range = segment?.target_timerange;
      if (!range || !(range.duration > 0)) {
        continue;
      }

      const material = textMap.get(segment?.material_id);
      const parsed = parseTextItemContent(material);
      const text = parsed?.text;

      if (typeof text !== 'string' || !text.trim()) {
        continue;
      }

      cues.push({
        start: range.start,
        duration: range.duration,
        text: text.replace(/\r?\n/g, '\n').trim()
      });
    }
  }

  if (!cues.length) {
    throw new Error('No subtitle text with timing was found to export.');
  }

  cues.sort((a, b) => a.start - b.start);

  console.log(`[service] exportSrt — ${cues.length} subtitle cue(s) collected`);

  return {
    draftFileName: resolvedDraftFileName,
    cueCount: cues.length,
    srt: formatSrt(cues)
  };
}

// Image Sync with Subtitle — independent of CapCut's own subtitle system.
// Retimes each image/video clip on the primary visual track so that one
// subtitle block (from pasted or uploaded SRT) drives one clip's duration.
// It never creates or edits text/subtitle segments.
async function applyImageSync({ projectPath, draftFileName, srtText, backupRoot }) {
  const cues = parseSrt(srtText);
  console.log(`[service] applyImageSync — parsed ${cues.length} subtitle block(s) from SRT`);
  const { draftFilePath, draftFileName: resolvedDraftFileName } = await resolveDraftFile(projectPath, draftFileName);
  const projectJson = await readJson(draftFilePath);
  const materialMap = buildVideoMaterialMap(projectJson);
  const tracks = Array.isArray(projectJson?.tracks) ? projectJson.tracks : [];

  // Primary visual track = the video track holding the most image/video clips.
  let primaryTrack = null;
  let primaryCount = 0;

  for (const track of tracks) {
    if (track?.type !== 'video') {
      continue;
    }
    const count = (track.segments || []).filter((segment) =>
      isVisualMaterial(materialMap.get(segment?.material_id))
    ).length;
    if (count > primaryCount) {
      primaryCount = count;
      primaryTrack = track;
    }
  }

  if (!primaryTrack) {
    throw new Error('No image or video clips were found to sync.');
  }

  const visualSegments = (primaryTrack.segments || [])
    .filter((segment) => isVisualMaterial(materialMap.get(segment?.material_id)))
    .sort((a, b) => (a?.target_timerange?.start || 0) - (b?.target_timerange?.start || 0));

  const backup = await createProjectBackup({ projectPath, backupRoot });

  const pairCount = Math.min(visualSegments.length, cues.length);
  let cursor = 0;

  for (let i = 0; i < pairCount; i += 1) {
    const segment = visualSegments[i];
    const cue = cues[i];
    const material = materialMap.get(segment.material_id);

    let duration = cue.duration;
    // Real footage cannot play longer than its source; photos are effectively unbounded.
    if (material?.type === 'video' && material.duration > 0) {
      duration = Math.min(duration, material.duration);
    }

    segment.target_timerange = { start: cue.start, duration };

    const sourceStart = segment.source_timerange?.start || 0;
    segment.source_timerange = { start: sourceStart, duration };

    cursor = cue.start + duration;
  }

  // Leftover clips (more clips than subtitle blocks) are laid out contiguously
  // after the last synced block, keeping their existing durations.
  for (let i = pairCount; i < visualSegments.length; i += 1) {
    const segment = visualSegments[i];
    const duration = segment?.target_timerange?.duration || 0;
    segment.target_timerange = { start: cursor, duration };
    cursor += duration;
  }

  projectJson.duration =
    typeof projectJson.duration === 'number' ? Math.max(projectJson.duration, cursor) : cursor;

  await writeJsonAtomically(draftFilePath, `${JSON.stringify(projectJson, null, 2)}\n`);

  console.log(
    `[service] applyImageSync done — ${pairCount} clip(s) retimed ` +
      `(${visualSegments.length} clip(s) on track vs ${cues.length} block(s)), new duration=${cursor}us`
  );

  return {
    backupId: backup.backupId,
    draftFileName: resolvedDraftFileName,
    syncedCount: pairCount,
    clipCount: visualSegments.length,
    cueCount: cues.length
  };
}

async function emptyDirectory(targetPath) {
  const entries = await safeReadDir(targetPath);

  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    await fs.rm(entryPath, { recursive: true, force: true });
  }
}

async function restoreLatestBackup({ projectPath, backupRoot }) {
  const projectBackupRoot = path.join(backupRoot, sanitizeSegment(path.basename(projectPath)));
  const entries = await safeReadDir(projectBackupRoot);
  const backups = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();

  if (!backups.length) {
    throw new Error('No backups are available for this project yet.');
  }

  const restoredBackupId = backups[0];
  const restoreSource = path.join(projectBackupRoot, restoredBackupId, 'project');

  if (!(await fileExists(restoreSource))) {
    throw new Error('The latest backup is incomplete and cannot be restored.');
  }

  await createProjectBackup({
    projectPath,
    backupRoot,
    backupLabel: `${createBackupId()}-pre-restore`
  });

  await emptyDirectory(projectPath);
  await fs.cp(restoreSource, projectPath, {
    recursive: true,
    force: true,
    errorOnExist: false
  });

  console.log(`[service] restored project from backup "${restoredBackupId}"`);

  return {
    restoredBackupId
  };
}

module.exports = {
  scanProjects,
  extractCaptions,
  createProjectBackup,
  applyCaptionChanges,
  restoreLatestBackup,
  applyAnimationPreset,
  exportSrt,
  applyImageSync,
  listAnimationPresets: animationPresets.listPresets
};
