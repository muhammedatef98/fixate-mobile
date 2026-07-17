# Changelog

Notable changes to the Fixate mobile app. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versioning follows
[SemVer](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-07-17

### Added
- Offer marketplace: technicians bid on repair requests, the accepted offer is
  the price basis for payment
- Courier role with live location tracking and document verification
- In-app wallet, invoices, and admin payment modes
- Push notifications via Expo Push (order dispatch, offers, status changes)
- Realtime chat between customer, technician, and courier
- Technician community feed with admin moderation
- Repair warranty derived from completed orders (12 months)
- Pricing registry (add-ons and rules) with repair estimates
- Admin area: RBAC permissions, technician verification (approve / reject /
  request changes), support inbox, scheduled automations

### Changed
- Upgraded to the Firebase 25 native runtime (new EAS build runtime)
- Unified order status metadata (colors, icons, progress) into a single source
- Shared chat bubble/composer geometry across all chat surfaces

### Security
- Revoked client EXECUTE on unguarded cron RPCs; pinned function search paths
- Push dispatch restricted to authorized user IDs; OTP rate-limited
- Removed unused dependencies flagged in the security audit

## [1.0.0] - 2025-12-22

Initial release.

- Customer flow: request a repair, live technician tracking, media upload,
  ratings and reviews
- Technician flow: nearby job feed, status pipeline, earnings
- Supabase backend: Postgres with RLS everywhere, Auth, Storage, Realtime,
  Edge Functions
- Email OTP login and password reset (Resend edge function, no SMS provider)
- Saudi-specific verification: National ID / Iqama checksum, IBAN validation,
  document upload
- Bilingual Arabic/English with full RTL support, dark mode

[1.0.1]: https://github.com/muhammedatef98/fixate-mobile/releases/tag/v1.0.1
[1.0.0]: https://github.com/muhammedatef98/fixate-mobile/commits/main
