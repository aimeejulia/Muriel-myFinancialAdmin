# Changelog

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
