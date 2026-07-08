# CapCut Subtitle Editor

A cross-platform **Electron desktop app** for working with local CapCut projects:

- 🔎 **Scan** CapCut projects from the default local folders
- ✏️ **Extract & edit subtitles** (one caption per line), then write them back
- 🗄️ **Automatic backups** before every change, with one-click restore
- 🎞️ **Animation presets** — Zoom In/Out, Pan L→R, Pan Up→Down, Ken Burns, and **Cycle** (alternates per clip)
- 💾 **Export subtitles** as a timestamped `.srt`
- 🖼️ **Image Sync** — retime image/video clips so one subtitle block = one clip duration (paste or upload `.srt`, independent of CapCut's own subtitles)

> Built by Shaniyal Malik.

---

## Installation (end users)

Installers are unsigned, so the OS will warn on first launch — that's expected. Steps to get past it are below.

### 🪟 Windows

1. Download **`CapCut Subtitle Editor Setup 1.0.0.exe`** (from a GitLab pipeline's artifacts — see *Building the installers*).
2. Double-click it. If Windows **SmartScreen** appears, click **More info → Run anyway**.
3. It installs per-user (no admin prompt) and adds **Desktop** and **Start Menu** shortcuts.
4. Launch **CapCut Subtitle Editor** from the shortcut.

*Prefer no install?* A **portable** build also works: unzip `win-unpacked` and run `CapCut Subtitle Editor.exe` directly.

### 🍎 macOS

1. Download **`CapCut Subtitle Editor-1.0.0.dmg`**.
2. Open the `.dmg` and **drag the app into the Applications folder**.
3. First launch is blocked by **Gatekeeper** (unsigned app). Get past it one of two ways:
   - **Right-click** the app → **Open** → **Open**, **or**
   - **System Settings → Privacy & Security → Open Anyway**.
4. After the first launch it opens normally.

> Apple Silicon (M-series) and Intel are both supported; the installer matches the machine that built it.

---

## Requirements

- The app reads CapCut's **local desktop** projects from the default locations:
  - **Windows:** `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft`
  - **macOS:** `~/Movies/CapCut/User Data/Projects/com.lveditor.draft`
- CapCut must have created local drafts there for them to appear.

---

## Development

```bash
npm install      # install dependencies
npm start        # run the app locally (Electron)
```

Source layout:

| File | Purpose |
|------|---------|
| `main.js` | Electron main process + IPC handlers |
| `preload.js` | Secure context bridge (`window.capcutApi`) |
| `src/project-service.js` | Scan / extract / apply / backup / restore / SRT / image-sync |
| `src/animation-presets.js` | Ken Burns keyframe presets (incl. Cycle) |
| `src/srt.js` | SRT parse/format |
| `index.html`, `renderer.js`, `styles.css` | UI |

---

## Building the installers

Local build:

```bash
npm run dist:win   # Windows NSIS one-click installer  → dist/*.exe   (Windows host)
npm run dist:mac   # macOS .dmg                          → dist/*.dmg   (macOS host only)
```

> **Note:** a Windows local build needs **Developer Mode** enabled *or* an **Administrator** terminal (electron-builder unpacks a toolchain that creates symlinks). A `.dmg` can only be built on macOS.

### Via GitLab CI (recommended)

The included [`.gitlab-ci.yml`](.gitlab-ci.yml) builds installers on the right runners:

- **Windows** — runs on GitLab's free SaaS Windows runner.
- **macOS** — a manual job; needs a macOS runner (paid SaaS tier or a self-hosted Mac runner). It won't block the pipeline if no Mac runner exists.

To run it: **GitLab → Build → Pipelines → Run pipeline** (or push a tag like `v1.0.0`), then download the artifacts from the finished job.

---

## License

MIT
