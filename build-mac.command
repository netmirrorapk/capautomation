#!/bin/bash
#
# One-click macOS build for CapCut Subtitle Editor.
# Double-click this file in Finder, or run:  ./build-mac.command
# Produces an unsigned .dmg installer in the dist/ folder.
#
set -e

# Work from the folder this script lives in (so double-clicking works).
cd "$(dirname "$0")"

echo "======================================================"
echo "  CapCut Subtitle Editor — macOS installer build"
echo "======================================================"
echo

# 1. Require Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed."
  echo "   Install it from https://nodejs.org  (or run: brew install node)"
  echo
  read -n 1 -s -r -p "Press any key to close…"; echo
  exit 1
fi
echo "✓ Node $(node --version)   npm $(npm --version)"
echo

# 2. Install dependencies
echo "==> Installing dependencies (npm install)…"
npm install
echo

# 3. Build the .dmg (unsigned — no code-signing certificate needed)
echo "==> Building macOS installer (npm run dist:mac)…"
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run dist:mac
echo

# 4. Report output
echo "======================================================"
echo "  Done. Output in the dist/ folder:"
ls -1 dist/*.dmg dist/*.zip 2>/dev/null | sed 's/^/    /' || echo "    (no .dmg found — check the log above)"
echo "======================================================"
echo
echo "Note: the app is unsigned, so on first launch"
echo "      right-click it → Open → Open to get past Gatekeeper."
echo

# Keep the Terminal window open when launched by double-click.
read -n 1 -s -r -p "Press any key to close…"; echo
