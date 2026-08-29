# Changelog

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
