# Changelog

## 1.3.0

### Added
- The update banner shows the update steps for your install type: AppImage, Snap, Flatpak, or source checkout.
- The AppImage can update itself. Click Download and restart. The app checks the download before it replaces the AppImage.
- A source checkout can update itself with git. Click Update and restart.
- For Snap and Flatpak, the banner shows the install command, with a Copy command button.
- Each release has an AppImage, a Snap, and a Flatpak.

### Fixed
- Copy reminder copies the reminder to the clipboard again.
- The Flatpak encrypts the saved data. Before, it saved the data in plain text.
- Electron is updated to 44, a supported version with security fixes.
- The PDF library dependencies are updated to remove known security problems.

### Notes
- From version 1.2.0 or older, update one time by hand. Later updates can start from the app.
- The AppImage file name has no spaces now: `Muriel-myFinancialAdmin-1.3.0.AppImage`. If a shortcut opens the AppImage, change the shortcut to the new file name.

## 1.2.0

### Added
- A Cancel edit button on the invoice form.
- A warning banner when the app cannot save changes.
- Unit tests, end-to-end tests, ESLint and a CI workflow for pushes and pull requests.

### Fixed
- Editing an invoice does not delete it before you save the changes.
- Saves are crash safe. A damaged data file does not cause the backup to be overwritten.
- The safety backup is encrypted, and only the current user can read the data files.
- Restore accepts only Muriel backup files.
- Reports and the dashboard do not count draft invoices as invoiced.
- VAT is rounded to cents for each invoice, so reports agree with the invoice PDFs.
- Dates use the local time zone instead of UTC.
- An invoice for an inactive client keeps its client when you edit it.

### Notes
- The saved data records a schema version. Muriel does not load or overwrite data from a newer version.
- On the first save, the data files are encrypted if a keyring is available, and VAT amounts are rounded to cents. Export a backup before you update.

## 1.1.2

### Added
- Update prompt support for newly published releases, so users are alerted when a newer version is available.

### Fixed
- Versioning guard to prevent stale build artifacts from being shipped under an older release number.
- Release packaging validation to ensure dist outputs match the current package version.

## 1.1.1

### Added
- Client editing directly from the client list.
- Client status support with Active and Inactive states.
- Inactive clients are excluded from invoice dropdown selection.
- Storage compatibility for the app rename from the older Darwin naming.

### Fixed
- Legacy state file compatibility for migrated data.
- AppImage build metadata and version validation guard to prevent stale dist artifacts.
- Release packaging validation for stale version references.

### Notes
- This release keeps local data compatibility for users migrating from earlier app naming and packaged builds.
- The app is now protected against packaging stale artifacts from previous releases.
