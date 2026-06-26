# Fixate — Feature Sprint Implementation Plan

Status: **DRAFT — awaiting approval.** No code written yet.
Date: 2026-06-26

Conventions for every section: read the file fully before editing · never remove
working features · reuse existing design system / RTL utils · all new strings AR+EN
following existing bilingual pattern (`isRTL ? ar : en`) · every new table gets RLS ·
migrations land in `supabase/migrations/` and are applied only after per-migration approval.

---

## Current-state audit (what already exists)

| # | Feature | Already exists | Gap to build |
|---|---------|----------------|--------------|
| 1 | Notifications/broadcasts | `broadcasts` table, `broadcastService`, `admin-broadcasts.tsx`, robust `push-dispatch` Edge fn (Expo) | History UI + clear, `scheduled_notifications` (+cron), `notification_automations`, push→in-app insert |
| 2 | Offers | `offersService`, `admin-offers.tsx`, `offers` table | image upload, auto-notify toggle, audience |
| 3 | Invoice viewer | `invoicePdf.ts` (share-only), `InvoiceDownloadButton` | inline viewer modal (WebView) + View/Download buttons |
| 4 | Recent activity | merged feed in `admin.tsx` (capped 6) | "View All" → dedicated activity log screen w/ filter+paging |
| 5 | Warranty text | scattered "6 months"/"٦ أشهر", terms "7–90 days" | change all → 1 year / 12 months / 365 days |
| 6 | Smart assistant | `chatbot.tsx` (910 lines, Q&A pairs) | more Q&A, fix scroll (answer below), warranty=1yr |
| 7 | Addresses | `addresses.tsx`, `OsmMap`, `serviceAreasService`, map in `request.tsx` | map picker + reverse geocode + zone restriction in addresses |
| 8 | Notif settings + profile | `notification_preferences` (order_updates/promotions/technician_messages), `notifications-settings.tsx`, `(customer)/profile.tsx` | granular toggles (system, arrival), push-dispatch respects prefs, profile photo/phone/created/stats |
| 9 | Notification bell | `NotificationBell.tsx`, `notifications.tsx` | grouped-by-date redesign, mark-all-read, empty state, animations |
| 10 | Terms | `terms.tsx` (AR+EN) | ADD 6 new sections, keep existing |
| 11 | Accounting commission | `admin-accounting.tsx` w/ commission % stored in **AsyncStorage** | `commission_settings` table, per-order split, aggregates |
| 12 | Spare-parts suppliers | WhatsApp link pattern in `contact.tsx`/`market-detail.tsx` | `spare_parts_suppliers` table, admin CRUD, technician request sheet |
| 13 | Order timeline | visual timeline **derived from status** in `order-details.tsx` | `order_timeline` table + per-change inserts, 2-step clear-all-orders |
| 14 | Tip of the week | `WEEKLY_TIPS` + `getWeeklyTip()` (ISO week) in `(customer)/index.tsx` | rename → day, 30 tips, `dayOfYear % len` |
| 15 | Customer wallet | `wallet.tsx` shows **payment history only**; tech wallet is separate | real `wallets` + `wallet_transactions`, balance, checkout use |

---

## Proposed batches (low-risk first)

### Batch A — No migrations, pure client (safe, fast)
- **§5 Warranty → 1 year:** edit `payment.tsx`, `chatbot.tsx`, `(customer)/calculator.tsx`,
  `(customer)/index.tsx` (label + `warrantyExpiry` calc), `onboarding.tsx`, `terms.tsx` (10.2).
- **§14 Tip of the Day:** rename strings, expand to 30 phone/laptop/tablet/TV/appliance tips,
  switch `getWeeklyTip`→`getDailyTip` using `dayOfYear % len`.
- **§6 Smart assistant:** add Q&A pairs, set warranty=1yr, fix scroll so answer appears below
  question (scroll-to-end on tap).
- **§10 Terms:** append Warranty / Privacy & Data / Payment & Refunds / Technician Vetting /
  Limitation of Liability / Governing Law (AR+EN). Existing clauses untouched.
- **§3 Invoice viewer:** add inline modal (reuse `invoicePdf` HTML in a `react-native-webview`)
  with View (render) + Download/Share (existing flow). Wire into `InvoiceDownloadButton` callers.

### Batch B — Profile / activity / bell (mostly client, 1 small migration)
- **§4 Activity log:** new `admin-activity.tsx` full screen (filter by type, paginated);
  "View All" button in `admin.tsx`.
- **§9 Bell redesign:** rework `notifications.tsx` + dropdown — group Today/Yesterday/Earlier,
  relative time, unread highlight, mark-all-read, empty state, animations.
- **§8 part 1 — profile polish:** `(customer)/profile.tsx` photo upload (avatars bucket — already
  used elsewhere), phone (read-only), created-on, total orders + spent.

### Batch C — Notification system upgrade (migrations + edge fn)
- **§8 part 2 — granular prefs:** add `system_announcements`, `technician_arrival` columns to
  `notification_preferences`; expand `notifications-settings.tsx`; **push-dispatch filters by
  pref category** (needs a `category` in payload mapped to a pref column).
- **§1D — push→in-app:** push-dispatch inserts a row into the notifications-center table for each
  recipient so the bell shows it.
- **§1A — history:** collapsible/sub-screen of past broadcasts + Clear History (confirm dialog).
- **§1B — scheduled:** `scheduled_notifications` table + pg_cron job (every minute) → pg_net
  invoke push-dispatch → mark sent. Schedule form (one-time/daily/weekly/next-month preset).
- **§1C — automations:** `notification_automations` table + welcome-discount trigger on new
  customer signup; extensible toggles UI.
- **§2 — offers upgrade:** image upload (offers bucket), auto-notify toggle + audience, manual send.

### Batch D — Financial / order / supplier (migrations)
- **§11 commission:** `commission_settings` table (single row upsert), migrate accounting off
  AsyncStorage, per-order + aggregate split.
- **§13 timeline + clear:** `order_timeline` table, insert on every status change across app,
  render real timeline; 2-step clear-all-orders deleting orders + timeline + related.
- **§12 suppliers:** `spare_parts_suppliers` table, admin CRUD screen, technician order-detail
  "Request Spare Part" sheet w/ WhatsApp deep link + phone fallback.
- **§7 addresses map:** map picker in `addresses.tsx` reusing `OsmMap` + zone restriction +
  reverse geocode autofill.

### Batch E — Customer wallet (migrations, touches checkout)
- **§15:** `wallets` + `wallet_transactions` tables + RLS; upgrade `wallet.tsx` to show balance +
  credit/debit ledger (keep payment history); home/profile balance; promo credit; checkout use.

---

## Confirmed architectural decisions (2026-06-26)

1. **§1B scheduler** → pg_cron + pg_net, every minute, server-side.
2. **push-dispatch** → DO NOT modify the core Edge Function. Build a **separate wrapper**
   that does (a) in-app notification insert and (b) notification-preference category
   filtering, used only by broadcasts / offers / scheduled / automations. Order & chat
   pushes keep using the existing path unchanged.
3. **§15 wallet** → build `wallets` + `wallet_transactions` (balance, ledger, promo credit,
   display on home/profile). **Checkout integration stubbed** with `// TODO`. **Keep** the
   existing payment-history list as its own section/tab — do not replace it.
4. **§11 commission** → migrate to `commission_settings` single-row DB table as source of truth.
