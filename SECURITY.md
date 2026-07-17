# Security Policy

## Supported versions

Only the latest released version of the Fixate mobile app receives security
fixes.

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |
| < 1.0   | ❌        |

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security problems.

Instead, email **fixate01@gmail.com** with:

- A description of the issue and its impact
- Steps to reproduce (proof-of-concept if possible)
- Affected area (app screen, API/RPC, database policy, edge function)

You can expect:

- An acknowledgement within **72 hours**
- A status update within **7 days**
- Credit in the fix's release notes if you'd like it (or anonymity if you prefer)

Please give us a reasonable window to ship a fix before any public disclosure.

## Scope

In scope:

- The mobile app in this repository
- Supabase Row Level Security policies and RPCs under `supabase/`
- Edge functions (auth/OTP, payments, notifications)

Out of scope:

- Denial-of-service / rate-limit flooding
- Issues requiring a rooted/jailbroken device
- Third-party services themselves (Supabase, Expo, Resend, Firebase)

## Handling secrets

No credentials belong in this repository. Configuration is provided via
environment variables (see `.env.example`). If you believe a secret has been
committed, report it via the email above — it will be rotated immediately.
