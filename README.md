# Fixate 🔧

**Device repair, on demand — a Saudi-market mobile platform connecting customers with verified repair technicians.**

Customers request a repair, technicians bid on it, and the accepted offer becomes the price — followed through pickup, repair, delivery, and payment in one app. Built with React Native (Expo) on Supabase, bilingual Arabic/English with full RTL.

[![CI](https://github.com/muhammedatef98/fixate-mobile/actions/workflows/ci.yml/badge.svg)](https://github.com/muhammedatef98/fixate-mobile/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue.svg)](https://expo.dev)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Screenshots

| Login | Home | Services |
| :---: | :---: | :---: |
| <img src="screenshots/ios/01-login.png" width="220" alt="Login screen"> | <img src="screenshots/ios/02-home.png" width="220" alt="Customer home"> | <img src="screenshots/ios/03-services.png" width="220" alt="Service selection"> |

| Marketplace | Order tracking | Profile |
| :---: | :---: | :---: |
| <img src="screenshots/ios/04-market.png" width="220" alt="Offer marketplace"> | <img src="screenshots/ios/06-track-order.png" width="220" alt="Live order tracking"> | <img src="screenshots/ios/05-profile.png" width="220" alt="Profile"> |

## How it works

1. **Request** — the customer describes the device and issue, picks a location, and attaches photos.
2. **Bid** — nearby verified technicians see the request and submit offers.
3. **Accept** — the customer accepts an offer; that amount is the price basis (no post-inspection renegotiation). See [docs/payment-architecture.md](docs/payment-architecture.md).
4. **Repair** — the order moves through a tracked status pipeline with live technician/courier location and realtime chat.
5. **Pay & review** — payment in-app, then rating and review. Completed repairs carry a 12-month warranty derived from the order itself.

## App surfaces

| Surface | What it does |
| ------- | ------------ |
| **Customer** | Request repairs, compare offers, track orders live, chat, pay, review |
| **Technician** | Browse nearby requests, submit offers, manage the repair pipeline, earnings, community feed |
| **Courier** | Pickup/delivery tasks with live location broadcasting |
| **Admin** | RBAC-gated back office: technician verification, orders, pricing rules, support inbox, broadcasts, accounting |

## Key features

- **Offer marketplace** — competitive technician bids instead of fixed price lists
- **Phone OTP login** — SMS via Authentica edge functions, with cooldowns and daily send caps
- **Saudi-specific verification** — National ID / Iqama checksum, IBAN validation, document upload
- **Realtime everywhere** — chat, order status, and location tracking over Supabase Realtime
- **Push notifications** — Expo Push dispatch for order events, offers, and admin broadcasts
- **RTL + dark mode** — Arabic-first UI (Cairo font) with a full English mirror
- **RLS-everywhere schema** — every table behind Row Level Security; writes go through guarded RPCs

## Tech stack

| Layer | Choice |
| ----- | ------ |
| App | React Native 0.81 · React 19 · Expo SDK 54 · Expo Router · TypeScript 5 |
| Backend | Supabase — Postgres (RLS), Auth, Storage, Realtime, Edge Functions (Deno) |
| Payments | Stripe PaymentIntent created server-side in the `create-payment` edge function |
| Maps | React Native Maps + Google Places (optional key) |
| Push / email | Expo Push · Resend (technician-approval emails) |
| Tooling | Jest · ESLint · Prettier · GitHub Actions · EAS Build |

## Project structure

```
app/                  Expo Router screens — (customer), (technician), (courier), admin-*
components/           Reusable UI (BottomNav, RTLIcon, ErrorState, ...)
contexts/             AppContext, AuthContext, OrdersContext, RequestContext
services/             API wrappers (auth, orders, offers, payments, locations, ...)
lib/                  Supabase client
utils/                logger, validation, warranty, RTL helpers
types/                Domain types (Order, OrderStatus, ...)
constants/            theme, translations, issue categories
supabase/migrations/  Database migrations
supabase/functions/   Edge functions — create-payment, send-phone-otp, verify-phone-otp,
                      signup, push-dispatch, notify-segment, delete-account,
                      send-technician-approval-email
docs/                 Setup guides, architecture, business material
__tests__/            Jest unit tests
```

## Getting started

```bash
git clone https://github.com/muhammedatef98/fixate-mobile.git
cd fixate-mobile
pnpm install
cp .env.example .env   # fill in EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
pnpm start             # press i / a, or scan the QR with Expo Go
```

First-time backend setup (Supabase project, OAuth, Firebase push, production checklist):
[docs/setup/QUICK_START.md](docs/setup/QUICK_START.md).

### Environment notes

- Only the two `EXPO_PUBLIC_SUPABASE_*` variables are required to run the app.
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is optional: it enables Google-powered place search
  (better Arabic coverage). Without it, the location picker falls back to the platform
  geocoder. See [.env.example](.env.example) for key restrictions.

## Scripts

| Script | What it does |
| ------ | ------------ |
| `pnpm start` | Start the Expo dev server |
| `pnpm test` | Run Jest unit tests |
| `pnpm test:ci` | Tests in CI mode (no watch) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier write |

## Docs

- [Setup guides](docs/setup/) — Supabase, OAuth, Firebase, production checklist
- [Payment architecture](docs/payment-architecture.md) — offer-based pricing model
- [Business overview](docs/business/INVESTOR_SUMMARY.md) — market story and pricing research

## Contributing & license

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md), and [SECURITY.md](SECURITY.md) for
reporting vulnerabilities. Licensed under [MIT](LICENSE).

Contact: **fixate01@gmail.com**

---

## 🇸🇦 بالعربية

**Fixate** — منصّة سعودية لصيانة الأجهزة الإلكترونية: العميل يطلب الصيانة، الفنيون المعتمدون يقدّمون عروض أسعار، والعرض المقبول هو السعر النهائي — مع تتبّع مباشر، محادثة فورية، دفع داخل التطبيق، وضمان ١٢ شهرًا على الإصلاح. التطبيق عربي بالكامل مع دعم RTL والوضع الليلي.

**ابدأ:** `pnpm install` ثم انسخ `.env.example` إلى `.env` واملأه، ثم `pnpm start`.
**الأدلة:** [docs/setup/](docs/setup/)
