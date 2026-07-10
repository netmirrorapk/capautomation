# CapCut Subtitle Editor — Setup & Build Guide

Yeh ek **Electron desktop app** hai. Neeche steps follow karo — Windows aur Mac dono ke liye.

---

## 0. One-time requirement: Node.js (dono OS ke liye)

App chalane ya build karne se pehle **Node.js (v18 ya usse naya)** install hona chahiye.

- Download: **https://nodejs.org** → "LTS" version install karo.
- Check karo (Terminal / PowerShell me):
  ```bash
  node --version
  npm --version
  ```
  Agar version number dikhe → ready ho.

---

## 🪟 WINDOWS

### Step 1 — ZIP extract karo
`CapCut-Subtitle-Editor-Source.zip` ko right-click → **Extract All** → koi folder chuno.

### Step 2 — Folder me terminal kholo
Extract kiye folder ke andar jao, address bar me `powershell` likh ke Enter dabao
(ya Shift + Right-click → "Open PowerShell window here").

### Step 3 — Dependencies install karo
```powershell
npm install
```
(Pehli baar thoda time lega — internet se packages download honge.)

### Step 4 — App chalao (test)
```powershell
npm start
```
App ki window khul jayegi. ✅

### Step 5 — Installer (.exe) banao
```powershell
npm run dist:win
```
- ⚠️ **Zaroori:** yeh command **Administrator PowerShell** me chalao,
  YA Windows me **Developer Mode** ON karo
  (Settings → Privacy & Security → For developers → Developer Mode → On).
  Warna "cannot create symbolic link" error aata hai.
- Ban jane ke baad installer yahan milega:
  `dist\CapCut Subtitle Editor Setup 1.0.0.exe`
- Us `.exe` ko double-click karke install karo. SmartScreen warning aaye to
  **More info → Run anyway**.

---

## 🍎 MAC

### Step 1 — ZIP extract karo
`CapCut-Subtitle-Editor-Source.zip` par double-click → folder ban jayega.

### Step 2 — Folder me Terminal kholo
Folder ko right-click → **New Terminal at Folder**
(ya Terminal khol ke `cd ` type karke folder drag-drop karo, phir Enter).

### Step 3 — Dependencies install karo
```bash
npm install
```

### Step 4 — App chalao (test)
```bash
npm start
```
App ki window khul jayegi. ✅

### Step 5 — Installer (.dmg) banao — 2 tarike

**Tarika A (aasan):** folder me diya hua script double-click karo:
`build-mac.command`
> Pehli baar chalane se pehle Terminal me ek baar:
> ```bash
> chmod +x build-mac.command
> ```
> Agar "unidentified developer" aaye → right-click → **Open** → **Open**.

**Tarika B (manual):**
```bash
npm run dist:mac
```

- Ban jane ke baad installer yahan milega:
  `dist/CapCut Subtitle Editor-1.0.0.dmg`
- `.dmg` khol ke app ko **Applications** me drag karo.
- Pehli baar kholte waqt (unsigned app): app par **right-click → Open → Open**,
  ya **System Settings → Privacy & Security → Open Anyway**.

> Note: `.dmg` sirf **Mac** par hi ban sakta hai — Windows par nahi.
> Aur `.exe` sirf **Windows** par. Yeh normal hai.

---

## Quick command reference

| Kaam | Command |
|------|---------|
| Dependencies install | `npm install` |
| App run (test)       | `npm start` |
| Windows installer    | `npm run dist:win`  → `dist/*.exe`  (Windows only) |
| Mac installer        | `npm run dist:mac`  → `dist/*.dmg`  (Mac only) |

---

## App kya karta hai (short)

- CapCut ke local projects scan karta hai
- Subtitles extract + edit + wapas save
- Har change se pehle **auto backup** (restore bhi hota hai)
- Animation presets (Zoom, Pan, Ken Burns, **Cycle**)
- Subtitles ko **.srt** me export
- **Image Sync** — ek subtitle block = ek clip duration

## Common problems

- **`npm: command not found`** → Node.js install nahi hai (Step 0).
- **Windows build "symbolic link" error** → Admin PowerShell / Developer Mode ON karo.
- **App me projects nahi dikh rahe** → CapCut me local drafts hone chahiye:
  - Windows: `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft`
  - Mac: `~/Movies/CapCut/User Data/Projects/com.lveditor.draft`
