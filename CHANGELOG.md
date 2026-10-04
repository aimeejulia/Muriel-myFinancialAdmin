# Changelog

## Unreleased

### Added
- You can write an invoice in the currency of the client. Muriel gets the ECB exchange rate of the issue date, or of the service date when you enter one.
- An invoice in another currency shows the exchange rate and the subtotal, VAT and total in the book currency. The PDF shows them too.
- Mark paid asks for the amount that arrived in your bank account, after bank charges. Reports and the dashboard use this amount as income.
- The reports show Received and Income in place of Marked paid. The invoice CSV has a Received column.
- A paid invoice has a Mark unpaid button, so you can correct the payment date or the amount received.
- You can record an expense in the currency of the receipt. Muriel gets the ECB exchange rate and fills in the amount paid in the book currency.
- You can change the book currency from a date. Invoices and expenses before the date keep their book currency.
- A report or dashboard for a period with two book currencies shows the totals of each book currency separately.

### Fixed
- A date that does not exist in an imported PDF, for example 31/02/2026, is not used.
- An imported expense gets its category from whole words. Before, "made" or "address" made an expense Marketing.
- The description of an imported invoice ends at the next field. Before, it also contained the amounts after it.
- Amounts at the end of a sentence in an imported PDF, for example "Total: 1,234.56.", are read correctly.
- A new invoice keeps its client when the app shows the data again.
- The expense list and the dashboard use the reporting currency.
- The app asks before it removes a trading name or a payment method.
- You can use the modals with the keyboard and with screen readers. Escape closes a modal.
- Restore examines each record in a backup before it restores the backup.
- A release candidate is told about the final release.
- CSV exports protect against formulas in client names and notes.
- The app accepts requests only from its own page, refuses popup windows, and sets the Electron fuses in the packaged app.

### Notes
- The saved data moves to schema version 3. Muriel 1.3.0 and older cannot open data that this version saved, so do not go back to an older version after the update. Your figures do not change.

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
