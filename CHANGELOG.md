# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-11-12

### Added
- Initial open-source release
- Angular 18 + Node/Express BFF in a single Docker container
- Dashboard with KPIs, charts, and freshness indicators
- Asset list with search, sort, pagination, CSV export, server/workstation filters
- Asset detail page with hardware/software summary and editable administrative fields
- Software inventory aggregation
- SQL Server instances report (with edition filter)
- Windows/Linux update status report
- BitLocker encryption status in asset detail
- Dark mode with system preference detection
- OIDC/SSO authentication (Microsoft Entra ID) with group-based authorization
- Configurable administrative field labels (from `accountinfo_config` or JSON file)
- Configurable server-type detection and description field
- Security hardening: helmet CSP, rate limiting, MySQL session store, non-root container
- MIT license
