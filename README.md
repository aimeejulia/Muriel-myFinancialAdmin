# Muriel - myFinancialAdmin

Local-first financial admin desktop app built with Electron.

The software is named after Muriel Siebert.

## Runtime Requirements

- Node.js 22.12.0 or newer
- npm 10 or newer

Version checks are enforced by:

- `.nvmrc`
- `package.json` `engines`
- `scripts/check-node.js` (runs during `npm install`)

## Installation Guide For Beginners

### Super Quick Install (AppImage)

If you already have an `.AppImage` file:

1. Put the `.AppImage` file in `Downloads`.
2. Right-click the file and open `Properties`.
3. In `Permissions`, enable `Allow executing file as program`.
4. Double-click the file.

If it does not open, right-click it and choose `Run as Program`.

### Method 1: Run A Downloaded AppImage

1. Save the `.AppImage` in `Downloads`.
2. Enable `Allow executing file as program`.
3. Double-click to start.

If double-click still does nothing:

```bash
sudo apt update
sudo apt install -y libfuse2
```

### Method 2: Run From Source

1. Install Node with nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

2. Restart Terminal and select Node:

```bash
nvm install 22.12.0
nvm use 22.12.0
node -v
```

3. In the project folder:

```bash
npm install
npm run start
```

## Build And Use AppImage

Build:

```bash
npm run package:appimage
```

Pre-build validation runs automatically. To run it manually:

```bash
npm run check:appimage-config
```

Expected output location:

- `dist/Muriel - myFinancialAdmin-*.AppImage`

Run from terminal:

```bash
./dist/Muriel\ -\ myFinancialAdmin-1.0.1.AppImage
```

### Optional Desktop Shortcut (Choose One Method)

Method A: Manual launcher entry

```bash
chmod +x ./dist/Muriel\ -\ myFinancialAdmin-1.0.1.AppImage
mkdir -p ~/.local/share/applications
desktop-file-install --dir=$HOME/.local/share/applications \
  --set-key=Exec --set-value="$PWD/dist/Muriel - myFinancialAdmin-1.0.1.AppImage" \
  <(echo "[Desktop Entry]
Name=Muriel - myFinancialAdmin
Comment=Local-first financial admin desktop app
Exec=${PWD}/dist/Muriel - myFinancialAdmin-1.0.1.AppImage
Icon=com.muriel.myfinancialadmin
Type=Application
Categories=Office;Finance;
StartupWMClass=Muriel - myFinancialAdmin")
```

Method B: AppImageLauncher

```bash
sudo apt install appimagelauncher
```

Use only one method. Using both creates duplicate desktop shortcuts.

### Duplicate Shortcut Cleanup

```bash
find ~/.local/share/applications -maxdepth 1 -type f | grep -Ei "muriel|financial|appimage|com\\.muriel" || true
rm -f ~/.local/share/applications/muriel-myfinancialadmin-local.desktop
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database ~/.local/share/applications
fi
```

If your app menu still shows both icons, log out and back in once.

### GNOME Pin To Dash

After creating a single launcher entry, open Activities, search for "Muriel - myFinancialAdmin", launch it once, then right-click the Dock icon and choose "Pin to Dash".

If pinning does not appear, refresh desktop entries:

```bash
update-desktop-database ~/.local/share/applications || true
```

## Linux Packaging

Build all configured Linux targets:

```bash
npm run package:linux
```

This includes AppImage, Flatpak, and Snap.

### Flatpak

```bash
npm run package:flatpak
```

If Flatpak tools are missing, install:

```bash
sudo apt update && sudo apt install -y flatpak flatpak-builder
```

Metadata templates:

- `flatpak/com.muriel.myfinancialadmin.desktop`
- `flatpak/com.muriel.myfinancialadmin.metainfo.xml`

### Snap

```bash
npm run package:snap
```

Typical output:

- `dist/muriel-myfinancialadmin_1.0.0_amd64.snap`

## Troubleshooting

### nvm command not found

1. Close and reopen Terminal.
2. Run `nvm install 22.12.0` and `nvm use 22.12.0` again.

### Unsupported Node.js version

```bash
nvm use 22.12.0
```

### npm install fails

```bash
npm cache clean --force
npm install
```

### AppImage does not launch

```bash
sudo apt update
sudo apt install -y libfuse2
```

## Release QA Checklist

Use [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md) before publishing a release.
