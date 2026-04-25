# Release QA Checklist

Use this checklist before publishing any release.

## 0) Environment Check

- [ ] Node version is 22.12.0 or newer.
- [ ] npm version is 10 or newer.
- [ ] Working tree is clean or intentionally staged.

Commands:

```bash
node -v
npm -v
git status
```

## 0.5) Build Configuration Validation

Before building AppImage or multi-target builds, validate the desktop integration configuration:

```bash
npm run check:appimage-config
```

This ensures the AppImage will support double-click execution from file managers. The validation automatically runs before `npm run package:appimage` and `npm run package:linux`, but you can run it manually to verify your configuration before starting a build.

## 1) Build Artifacts

Build each Linux artifact separately:

```bash
npm run package:appimage
npm run package:snap
npm run package:flatpak
```

Optional combined build:

```bash
npm run package:linux
```

Use the combined command only if the required toolchains for every configured
target are already installed.

Confirm files exist:

```bash
ls -lah dist/*.AppImage
ls -lah dist/*.snap
ls -lah dist/*.flatpak
```

If `dist/*.flatpak` is missing but you see a folder like `dist/__flatpak-x86_64`,
the Flatpak packaging process started but could not finish because the Flatpak
toolchain is missing.

Install required tools and build again:

```bash
sudo apt update && sudo apt install -y flatpak flatpak-builder
npm run package:flatpak
```

- [ ] AppImage exists in dist.
- [ ] Snap exists in dist.
- [ ] Flatpak exists in dist.

## 2) AppImage Local Test

```bash
chmod +x dist/*.AppImage
./dist/*.AppImage
```

Checks:

- [ ] App launches.
- [ ] No startup crash.
- [ ] Create a client successfully.
- [ ] Create an invoice successfully.
- [ ] Create an expense successfully.
- [ ] Close and reopen app, data is still there.

## 3) Snap Local Test

Install and run:

```bash
sudo snap install --dangerous dist/*.snap
snap run muriel-myfinancialadmin
```

Cleanup after test:

```bash
sudo snap remove muriel-myfinancialadmin
```

Checks:

- [ ] App launches from snap run.
- [ ] Core flows work (client, invoice, expense).
- [ ] Data persists after restart.

## 4) Flatpak Local Test

Install and run:

```bash
flatpak install --user --reinstall ./dist/*.flatpak
flatpak run com.muriel.myfinancialadmin
```

Cleanup after test:

```bash
flatpak uninstall com.muriel.myfinancialadmin
```

Checks:

- [ ] App launches from flatpak run.
- [ ] Core flows work (client, invoice, expense).
- [ ] Data persists after restart.

## 5) Regression Smoke Tests

- [ ] Invoice preview opens.
- [ ] Reminder copy buttons work.
- [ ] CSV exports work.
- [ ] PDF import still works.
- [ ] Expense receipt view still works.
- [ ] Profile save feedback displays and hides correctly.

## 6) Security and Packaging Checks

- [ ] No new errors in VS Code Problems panel.
- [ ] No obvious console runtime errors.
- [ ] CSP still present in index.html.
- [ ] Packaging did not fall back to default Electron icon (if app icon is configured).

## 7) Release Notes and Metadata

- [ ] Version number updated where needed.
- [ ] Changelog/release notes written.
- [ ] Flatpak metadata release entry updated.
- [ ] Store descriptions and screenshots are current.

## 8) Go/No-Go

- [ ] All required checks passed.
- [ ] Artifacts uploaded to release draft.
- [ ] Ready to publish.
