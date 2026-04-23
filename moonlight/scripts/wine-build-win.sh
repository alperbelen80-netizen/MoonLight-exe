#!/usr/bin/env bash
# MoonLight v2.6-3 — Best-effort Linux → Windows `.exe` build via Wine.
#
# Official path is GitHub Actions `windows-latest` runner (see
# `.github/workflows/release.yml`). This script is a convenience for
# developers who want to produce a Windows NSIS installer locally on a
# Linux machine using Wine.
#
# Known caveats:
#   - Native modules (sqlite3, keytar) must be cross-compiled for Windows.
#     This script uses prebuilt binaries where available (electron-builder
#     will download them) and falls back to source rebuild inside Wine.
#   - Large, fragile, slow. Use GitHub Actions for reliable releases.
#
# Usage:
#   ./scripts/wine-build-win.sh
#
# Optional env:
#   WINEARCH=win64 WINEPREFIX=$HOME/.wine_moonlight
#   SKIP_WINE_INSTALL=1   # skip apt install step (assume wine pre-installed)

set -euo pipefail

say() { printf "\033[1;36m[wine-build]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[wine-build][warn]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[wine-build][FAIL]\033[0m %s\n" "$*" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# 1. Install Wine + NSIS + mono if missing (Debian/Ubuntu).
if [[ "${SKIP_WINE_INSTALL:-0}" != "1" ]]; then
  if ! command -v wine >/dev/null 2>&1; then
    say "Installing Wine + NSIS + mono (requires sudo)"
    sudo dpkg --add-architecture i386
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends \
      wine wine32 wine64 mono-runtime nsis
  else
    say "Wine already installed: $(wine --version)"
  fi
fi

export WINEARCH="${WINEARCH:-win64}"
export WINEPREFIX="${WINEPREFIX:-$HOME/.wine_moonlight}"
export WINEDEBUG="${WINEDEBUG:--all}"

# 2. Build backend + bundle.
say "Building backend (TypeScript → dist)"
yarn --cwd backend build

say "Bundling backend (esbuild --minify)"
node scripts/bundle-backend.js --minify

# 3. Install isolated backend runtime deps (platform-independent JS).
say "Installing isolated backend runtime deps"
(
  cd backend
  # Use npm to avoid yarn workspace hoisting; this keeps deps under
  # backend/node_modules/ where electron-builder can pick them up.
  npm install --omit=dev --no-package-lock --no-audit --no-fund
)

# 4. Desktop install + build.
say "Installing desktop dependencies"
yarn --cwd desktop install --frozen-lockfile

say "Building desktop renderer + main"
yarn --cwd desktop build

# 5. Package for Windows. electron-builder will internally invoke
# makensis (present on host) and download electron-win32-x64 binaries.
say "Packaging Windows NSIS installer (x64) via Wine"
(
  cd desktop
  CSC_IDENTITY_AUTO_DISCOVERY=false \
    npx electron-builder --win nsis --x64
)

say "Artifacts:"
ls -lah desktop/dist/ || true
say "Done. Upload desktop/dist/*.exe for distribution."
