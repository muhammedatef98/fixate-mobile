# Fixate

**A Saudi-market platform for on-demand electronics repair. Customers post a repair request, verified technicians bid on it, and the accepted offer is the final price — tracked through pickup, repair, delivery, and payment in one app.**

Four roles share one codebase: customer, technician, courier, and a full admin back office. Arabic-first with complete RTL support and an English mirror, built on React Native (Expo) and Supabase.

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

## How Fixate works

1. **Request** — the customer picks the device and issue, sets a location, attaches photos.
2. **Bid** — verified technicians in the service area see the request and submit priced offers. Requests that get no response auto-expire.
3. **Accept** — accepting an offer locks the price. There is no post-inspection renegotiation; the accepted amount plus delivery fee and any add-ons is what the customer pays ([payment architecture](docs/payment-architecture.md)).
4. **Repair** — the order moves through an explicit status pipeline. Customers watch technician and courier locations live and chat in-app at every stage.
5. **Pay and review** — payment is recorded in-app, the customer rates the job, and the completed order itself carries a 12-month repair warranty (computed from order history, not a separate ledger).

## App surfaces

| Surface | What it covers |
| ------- | -------------- |
| **Customer** | Request repairs, compare offers, price calculator, live tracking, chat, wallet, reviews |
| **Technician** | Nearby request feed, offer submission, repair pipeline, earnings, skills, community feed |
| **Courier** | Pickup and delivery tasks with live location broadcasting and document verification |
| **Admin** | 27 RBAC-gated screens: technician verification, orders, pricing rules, service areas, support inbox, broadcasts, accounting |

## Key capabilities

- **Offer marketplace** — competitive technician bids replace a fixed price list; the estimate engine gives customers a reference range before offers arrive
- **Phone OTP auth** — SMS one-time codes via Authentica edge functions, with resend cooldowns and daily per-number caps
- **Saudi-specific verification** — National ID / Iqama checksum validation, IBAN checks, and document upload for technician and courier onboarding
- **Realtime by default** — order status, chat, and location updates flow over Supabase Realtime channels
- **Push notifications** — Expo Push dispatch for order events, offers, and segmented admin broadcasts
- **RLS everywhere** — all tables sit behind Row Level Security and sensitive writes go through guarded RPCs; the schema has grown through 80+ versioned migrations
- **Arabic-first UI** — RTL layout, Cairo typography, dark mode, and a Saudi Riyal symbol font

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
supabase/migrations/  Versioned database migrations
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

- The two `EXPO_PUBLIC_SUPABASE_*` variables are the only ones required to run the app.
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is optional. With it, the location picker gets
  Google-powered place search with strong Arabic coverage; without it, it falls back to
  the platform geocoder. See [.env.example](.env.example) for key-restriction notes.

## Scripts

| Script | What it does |
| ------ | ------------ |
| `pnpm start` | Start the Expo dev server |
| `pnpm test` | Run Jest unit tests |
| `pnpm test:ci` | Tests in CI mode (no watch) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier write |

## Docs worth opening next

- [Payment architecture](docs/payment-architecture.md) — how offer-based pricing, fees, and payment recording fit together
- [Setup guides](docs/setup/) — Supabase, OAuth, Firebase, production checklist
- [Business overview](docs/business/INVESTOR_SUMMARY.md) — market context and pricing research

## Contributing & license

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md), and [SECURITY.md](SECURITY.md) for
reporting vulnerabilities. Licensed under [MIT](LICENSE).

Contact: **fixate01@gmail.com**

---

## 🇸🇦 بالعربية

**Fixate** — منصّة سعودية لصيانة الأجهزة الإلكترونية: العميل ينشر طلب صيانة، الفنيون المعتمدون يقدّمون عروض أسعار، والعرض المقبول هو السعر النهائي — مع تتبّع مباشر، محادثة فورية، دفع داخل التطبيق، وضمان ١٢ شهرًا على الإصلاح. التطبيق عربي بالكامل (RTL + الوضع الليلي) ويشمل أربعة أدوار: عميل، فني، مندوب توصيل، وإدارة.

**التشغيل:** `pnpm install` ثم انسخ `.env.example` إلى `.env` واملأه، ثم `pnpm start` — الأدلة الكاملة في [docs/setup/](docs/setup/).
