# Release QA Checklist

Do these checks before you publish a release. The steps in [Publish a release](README.md#publish-a-release) tell you when.

Copy this checklist into the pull request or the release notes draft. When an item passes, mark it. Do not publish the release if an item fails.

## 1. Make sure that the checkout is ready

```bash
node -v
npm -v
git status
git log -1 --oneline
```

- [ ] Node.js is 22.12.0 or newer.
- [ ] npm is 10 or newer.
- [ ] The checkout is on `main`, with no changes to tracked files.
- [ ] The version in `package.json` is the new version.
- [ ] `CHANGELOG.md` has a section for the new version.
- [ ] The release tag, for example `v1.4.0`, is on the current commit.

## 2. Run the tests

```bash
npm run lint
npm test
npm run test:e2e
```

- [ ] The lint shows no errors.
- [ ] All unit tests pass.
- [ ] All end-to-end tests pass. A test that the ECB skips is not a failure.

## 3. Build the packages

Build all packages without a publish:

```bash
npm run release -- --dry-run
```

- [ ] The dry run shows no errors.
- [ ] `dist` contains the AppImage, the Snap, the Flatpak and `latest-linux.yml`.
- [ ] The package file names have no spaces.

If the Flatpak is missing, install the Flatpak tools, as [Build the packages](README.md#build-the-packages) tells you. Then do the dry run again.

## 4. Do a test of each package

CAUTION: Make a backup of your data before you start the test AppImage. The AppImage uses your real data folder.

To make a backup, click **Profile** > **Export backup** in your installed Muriel. The Snap and the Flatpak use their own data folders.

### AppImage

```bash
chmod +x dist/*.AppImage
./dist/*.AppImage
```

### Snap

```bash
sudo snap install --dangerous dist/*.snap
snap run muriel-myfinancialadmin
```

After the test, remove the Snap:

```bash
sudo snap remove muriel-myfinancialadmin
```

### Flatpak

```bash
flatpak install --user --reinstall ./dist/*.flatpak
flatpak run com.muriel.myfinancialadmin
```

After the test, remove the Flatpak:

```bash
flatpak uninstall --user com.muriel.myfinancialadmin
```

### Checks for each package

Do these checks in the AppImage, the Snap and the Flatpak:

| Check | AppImage | Snap | Flatpak |
|---|---|---|---|
| The app starts without errors. | [ ] | [ ] | [ ] |
| The app icon is the Muriel icon, not the Electron icon. | [ ] | [ ] | [ ] |
| **Profile** shows that the saved data is encrypted. | [ ] | [ ] | [ ] |
| You can add a client. | [ ] | [ ] | [ ] |
| You can make an invoice and download its PDF. | [ ] | [ ] | [ ] |
| You can record an expense. | [ ] | [ ] | [ ] |
| After a restart, the data is still there. | [ ] | [ ] | [ ] |

## 5. Do the smoke tests

Do these checks in the AppImage:

- [ ] An invoice in another currency gets an ECB exchange rate.
- [ ] The invoice PDF shows the VAT and the totals in the book currency.
- [ ] **Mark paid** asks for the amount received, and **Reports** shows it as **Received**.
- [ ] **Mark unpaid** makes a paid invoice unpaid again.
- [ ] An expense in another currency gets an ECB exchange rate.
- [ ] **Reminder** on an invoice copies a reminder to the clipboard.
- [ ] The three CSV exports download.
- [ ] **Import PDF** reads an invoice PDF.
- [ ] **Upload expense PDF** reads an expense receipt, and the receipt preview opens.
- [ ] **Export backup** saves a backup file, and **Restore backup** restores it.
- [ ] **Save profile** shows the message "Profile changes saved." and then hides it.
- [ ] The developer tools console shows no errors. To open it, press Ctrl+Shift+I.

## 6. Make sure that the metadata is correct

- [ ] `flatpak/com.muriel.myfinancialadmin.metainfo.xml` has a release entry for the new version.
- [ ] The descriptions and screenshots are correct for the new version.

## 7. Publish

- [ ] All items above pass.

Publish the release, as [Publish a release](README.md#publish-a-release) tells you.
