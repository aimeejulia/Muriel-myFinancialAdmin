# Muriel - myFinancialAdmin

Local-first financial admin desktop app built with Electron.

The software is named after Muriel Siebert.

## Runtime Requirements

- Node.js: 22.12.0 or newer
- npm: 10 or newer

This project enforces versions via:

- `.nvmrc`
- `package.json` `engines`
- `preinstall` check script at `scripts/check-node.js`

## Quick Start

1. Install and use the required Node version:
   - `nvm install 22.12.0`
   - `nvm use 22.12.0`
2. Install dependencies:
   - `npm install`
3. Run the desktop app:
   - `npm run start`

## Build AppImage

- `npm run package:appimage`

**Pre-build Validation:** The build command automatically validates that desktop integration metadata is configured. If validation fails, the build stops with a clear error message. Run `npm run check:appimage-config` anytime to validate the configuration.

### Using the AppImage

Once built, the AppImage is located at `dist/Muriel - myFinancialAdmin-*.AppImage`.

**Option 1: Direct Execution**
```bash
./dist/Muriel\ -\ myFinancialAdmin-1.0.1.AppImage
```

**Option 2: Desktop Integration (Recommended)**

For double-click support from your file manager, install the AppImage with proper desktop integration:

```bash
# Make the AppImage executable (should already be)
chmod +x ./dist/Muriel\ -\ myFinancialAdmin-1.0.1.AppImage

# Copy to Applications directory for system integration
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

Alternatively, use **AppImageLauncher** (if installed) which provides automatic integration:
```bash
sudo apt install appimagelauncher  # On Ubuntu/Debian
# Then double-click the AppImage to register it
```

**Troubleshooting AppImage Issues**

If the AppImage won't run:
1. Verify it's executable: `chmod +x Muriel\ -\ myFinancialAdmin-1.0.1.AppImage`
2. Check permissions: Should show `rwxr-xr-x` when you run `ls -l`
3. Run from terminal to see error output: `./Muriel\ -\ myFinancialAdmin-1.0.1.AppImage`
4. Ensure FUSE2 support is available (required by AppImage): `apt install libfuse2`

## Build All Linux Targets

- `npm run package:linux`

This builds every Linux target currently configured in `package.json`:

- AppImage
- Flatpak
- Snap

If Flatpak tools are missing, this combined command can stop before every target finishes.

## Build Flatpak (Step 1)

- `npm run package:flatpak`

Flatpak artifacts are generated in `dist/`.

If Flatpak tools are missing, you may only see a staging folder such as
`dist/__flatpak-x86_64` instead of a final `.flatpak` file.

Required tools for Flatpak packaging:

- `flatpak`
- `flatpak-builder`

On Ubuntu/Debian:

- `sudo apt update && sudo apt install -y flatpak flatpak-builder`

Flathub metadata templates are included in:

- `flatpak/com.muriel.myfinancialadmin.desktop`
- `flatpak/com.muriel.myfinancialadmin.metainfo.xml`

Before submitting to Flathub, update these fields in
`flatpak/com.muriel.myfinancialadmin.metainfo.xml`:

- `url` values (homepage and bugtracker)
- release history
- long description text (if needed)

## Build Snap (Step 2)

- `npm run package:snap`

Snap artifacts are generated in `dist/`.

Typical output file:

- `dist/muriel-myfinancialadmin_1.0.0_amd64.snap`

## Notes

If you run `npm install` with an older Node version, installation will stop with a clear error message describing the required version.

## Release QA Checklist

Use [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md) before publishing a release.
