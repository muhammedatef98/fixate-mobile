# Handoff: Offer Marketplace + Courier Role + Estimate Engine

> Context document generated 2026-07-05 from the implementation session.
> Purpose: give a fresh chat/agent full context on what shipped, how it works,
> where everything lives, and what is intentionally deferred to phase 2.

## TL;DR

Fixate (Expo/React Native + Supabase, bilingual AR/EN, repo `muhammedatef98/fixate-mobile`)
was upgraded from a **direct-claim** repair flow ("first technician takes the
pending order") to a **reverse marketplace** (technicians submit offers, the
customer accepts exactly one), with a brand-new **first-class courier role**
(device pickup/return logistics) and a **data-driven initial price-estimate
engine**. A follow-up **production-hardening pass** closed real RLS holes and
removed stale direct-claim flows.

- Shipped in commits `7beb3d6` (feature) and `c891eb6` (hardening) on `main`.
- All DB migrations **applied to the remote Supabase project** `fixate`
  (`gpucisjxecupcyosumgy`). `signup` edge function redeployed (v23).
- Status: **phase 1 signed off as production-ready** by the owner.
- **Pure JS/TS release** — no native changes, no new packages, no
  app.json/plugin/runtimeVersion changes → safe to ship via **EAS Update**.
- Verification: `npx tsc --noEmit` clean; Jest **12 suites / 128 tests passing**.
  (Note: `timeout` CLI doesn't exist on this Mac — run tsc/jest directly.)

## 1. Product model (current behavior)

### Customer flow
1. Creates a repair request (`app/request.tsx`, unchanged multi-step flow).
2. During creation sees an **"Estimated starting price"** card — explicitly an
   estimate, never a guaranteed price; copy says technicians will send offers.
3. Order is created with `status='pending'`, `technician_id=NULL` → this IS
   the "open for offers" state (labelled **"بانتظار العروض / Awaiting offers"**
   everywhere).
4. Reviews live offers on `app/order-offers.tsx` (realtime; tech name, rating,
   jobs, amount, note). Can **accept one** or **decline** individual offers.
5. Accepting runs an atomic RPC: technician assigned, order → `accepted`,
   `estimated_price` overwritten with the winning amount, losing offers →
   `expired`, and (for pickup&delivery orders) a **pickup delivery task** is
   auto-created. Everything downstream (inspection → technician final quote →
   customer approval → payment → repair → delivery → rating/invoice) is the
   pre-existing flow, untouched.

### Technician flow
- `app/(technician)/available-orders.tsx`: sees open requests (all verified
  techs, client-side distance sort — geo-scoping is phase 2), submits/revises
  an offer via a bottom sheet; card shows "Your offer: X SAR" if already quoted.
- `app/(technician)/manage-order.tsx`: offer card for open requests
  (submit/update/withdraw). **Direct "Accept Order" and the old FEAT-03
  "reject pending request" flows were removed** (reject = just don't offer).
- When order hits `delivering` on a pickup order: "Request return courier"
  button → idempotent `create_return_delivery_task` RPC.

### Courier flow (new first-class role)
- Role-selection (`app/role-selection.tsx`) has 3 cards under a
  **"Technician & Courier Portal"** label: Customer / Technician / Courier.
- Auth: `app/courier-auth.tsx` (wrapper) + `app/technician-auth.tsx` (wrapper)
  around shared `components/ProviderAuthScreen.tsx` (`flow` prop). Route
  segment matters: root `_layout` maps `courier-auth` → `/(courier)` post-login.
- Onboarding: `app/courier-onboarding.tsx` (city, vehicle car/motorcycle/van,
  optional ID) → upserts `couriers` row with `verification_status='submitted'`.
- Gate: `app/(courier)/_layout.tsx` mirrors the technician gate
  (no-profile / pending / changes_requested / rejected / allowed) via
  `utils/courierVerification.ts` (`mapCourierGate`, `isCourierEligible`).
- Portal: `app/(courier)/index.tsx` (Available / My tasks tabs, realtime pool,
  atomic accept) and `app/(courier)/task/[id].tsx` (pickup/dropoff cards with
  directions + call, progress bar, single enforced next action:
  accepted → picked_up → delivered → completed).

### Admin
- `app/admin-couriers.tsx` — "Couriers & Dispatch": application review
  (approve / request changes / reject, notifies applicant) + delivery-task
  monitor linking to the order. Tile added in `app/admin.tsx`.
- `app/admin-order-detail.tsx` — new **"Technician offers"** section (who
  quoted what, per-offer outcome); pricing row label is now
  "Initial estimate" / "Accepted offer" depending on assignment.
- Admin orders/reports filters relabelled to "Awaiting offers".

## 2. Database (all applied to remote `gpucisjxecupcyosumgy`)

Migrations (local files mirror remote):
- `supabase/migrations/20260704150000_courier_and_offer_marketplace.sql`
- `supabase/migrations/20260704150010_handle_new_user_courier_role.sql`
- `supabase/migrations/20260705100000_marketplace_security_hardening.sql`

Schema:
- `users.role` check → `('customer','technician','courier')`;
  `handle_new_user` trigger accepts `courier`.
- `couriers`: user_id (unique), city, vehicle_type, id_number,
  `verification_status` (pending/submitted/approved/rejected/changes_requested),
  `courier_status` (active/suspended/excluded), available, total_deliveries,
  verified_at.
- `delivery_tasks`: order_id, `task_type` (pickup/return, **unique per
  order+type** = dedupe guard), status
  (available/accepted/picked_up/delivered/completed/cancelled), courier_id,
  pickup_*/dropoff_* address/lat/lng/contact, notes, courier_fee (dormant),
  per-step timestamps.
- `order_offers`: order_id + technician_id (**unique pair** — re-quotes update
  in place), amount, note, status
  (pending/accepted/rejected/expired/withdrawn), created/updated/decided_at.
- Realtime publication includes `order_offers` + `delivery_tasks`.

RPCs (all SECURITY DEFINER, `search_path=''`, anon revoked, authenticated
granted — **the only write path** to offers/tasks; no direct INSERT/UPDATE
policies exist):
- `submit_order_offer(order_id, amount, note)` — requires approved+active
  technician; order locked FOR UPDATE; upsert; cannot resurrect
  accepted/rejected offers (`offer_already_decided`).
- `accept_order_offer(offer_id) → order_id` — caller must own the order;
  locks order then re-reads offer under lock (concurrent accepts serialize);
  assigns winner, expires competing pending offers, creates pickup
  delivery task for pickup orders.
- `reject_order_offer(offer_id)` / `withdraw_order_offer(offer_id)`.
- `accept_delivery_task(task_id)` — approved+active courier; conditional
  update (`status='available' AND courier_id IS NULL`) → race-safe;
  raises `task_no_longer_available`.
- `advance_delivery_task(task_id, next)` — enforced transition map, stamps
  timestamps.
- `create_return_delivery_task(order_id)` — caller must be the assigned
  technician, order in testing/delivering, pickup fulfillment; idempotent.

Security hardening (important — done in `20260705100000`):
- **Dropped** legacy `orders` policy "Technicians can accept available orders"
  (had NO with_check → any authed user could rewrite any open order) and
  removed the open-order branch from "Technicians update only assigned
  orders" (allowed self-assignment). Assignment is now RPC-only.
- **Trigger `trg_guard_courier_privileged`** on `couriers`: non-admin sessions
  cannot set `verification_status` (except back to 'submitted' on resubmit),
  `courier_status`, `total_deliveries`, `verified_at` — blocks self-approval
  via INSERT or UPDATE. `auth.uid() IS NULL` (service role) and admins pass.
- New `orders` SELECT policy: assigned couriers can read the orders behind
  their tasks (needed for delivery notifications + task context).

### Project-specific gotchas
- `public.is_admin` on this project takes a **uuid argument** — always write
  `is_admin(auth.uid())`, never `is_admin()`.
- Cross-user display names come from the `public_user_cards` view
  (`users` table is own-row-only under RLS).
- The realtime removal of taken orders from technicians' lists uses the
  pre-existing `broadcast_order_unavailable` trigger (private
  `available-orders` broadcast topic) — unchanged and still working, since
  acceptance flips status/technician_id exactly as before.

## 3. Estimate engine

- `utils/estimate.ts` — pure: `computeEstimate` (baseline typical/min/max ×
  spare-part tier × clamped regional/global multipliers, rounded to 5 SAR,
  range kept coherent), `formatEstimate` (always "Est. …" / "تقديري"),
  `parseEstimateConfig` (validates remote JSON, strips junk).
- `services/estimateService.ts` — reads `platform_settings` key
  **`pricing_estimates_v1`** (JSONB:
  `{ issues: {screen:{typical,min,max}}, regionMultipliers: {RUH:1.05}, globalMultiplier }`),
  5-min cache, silent fallback to `constants/repairData.ts` baselines.
- Wired into `app/request.tsx`: estimate card in the details step, recomputes
  on issue/tier/region change; the submitted `estimated_price` and discount
  validation both use the engine value. No admin UI yet (phase 2) — edit the
  `platform_settings` row directly.
- Multiplier clamp [0.5, 2] means a config typo can never produce absurd prices.

## 4. Routing / roles / persistence

- `utils/routeDecision.ts` (pure, tested): `AppFlow`/'courier',
  cold-launch → `/(courier)`, auth-flow `wantsCourier` + `profileRole==='courier'`
  fallback. Resolution order: admin > explicit customer > explicit technician >
  explicit courier > profile role.
- `utils/rolePreference.ts`: persists `'courier'`; cleared on logout.
- Root `app/_layout.tsx`: `(courier)` in PROTECTED_GROUPS; `courier-auth` in
  REDIRECT_AWAY_IF_LOGGED_IN + COURIER_AUTH_SOURCES; registered screens:
  `(courier)`, `courier-auth`, `courier-onboarding`, `order-offers`,
  `admin-couriers`.
- `app/available-requests.tsx` is now just a Redirect to
  `/(technician)/available-orders` (legacy direct-claim screen retired).

## 5. Notifications (client-side, best-effort via `notifyUsers`/push-dispatch)

- New request → technicians: "طلب جديد متاح للعروض 🛠️ … قدّم عرض سعرك الآن".
- Offer submitted → customer (deep-link data `screen:'order-offers'`).
- Offer accepted → winner; losers get "customer chose another offer".
- Offer rejected → that technician.
- Delivery accepted/picked_up/delivered → order customer + technician.
- Courier application decision → applicant.
- No push-tap deep-link handler exists in the app (pre-existing state); data
  payloads carry `screen` for when one is added.

## 6. Key files map

New: `services/offerMarketplaceService.ts`, `services/courierService.ts`,
`services/estimateService.ts`, `utils/estimate.ts`, `utils/deliveryTasks.ts`
(pure task state machine), `utils/courierVerification.ts`,
`components/ProviderAuthScreen.tsx`, `app/(courier)/{_layout,index,task/[id]}.tsx`,
`app/courier-auth.tsx`, `app/courier-onboarding.tsx`, `app/order-offers.tsx`,
`app/admin-couriers.tsx`, 3 migrations, tests
(`__tests__/{courierVerification,estimate,deliveryTaskFlow}.test.ts` + courier
cases in `routeDecision.test.ts`).

Deprecated but kept (fail loudly server-side now; no UI callers):
`orderService.assignOrderToTechnician`, `lib/supabase-api.ts requests.acceptOrder`.

## 7. Copy conventions (keep consistent)

- Open order status: **"بانتظار العروض" / "Awaiting offers"** (customer/admin),
  "متاح للعروض / Open for offers" (technician home).
- Estimate: **"السعر التقديري المبدئي" / "Estimated starting price"** — never
  "final", never "guaranteed", never "real market price".
- Courier: **"مندوب توصيل" / "Courier"**; portal label
  "بوابة الفنيين والمناديب / Technician & Courier Portal".
- Chatbot (`app/chatbot.tsx`) and onboarding slides already rewritten for the
  offer model + courier role — keep them in sync with any future flow change.

## 8. Phase 2 backlog (user-approved; do NOT scope-creep into phase 1)

1. **Geo-scoped offer visibility** (service-area/radius filtering in RLS/RPC;
   today all verified techs see everything, sorted by distance client-side).
2. **Offer expiry** — pg_cron job expiring stale pending offers.
3. **Courier payouts** — wire `courier_fee` into a wallet/fee model; add
   couriers as a push-audience segment.
4. **Admin pricing UI** for `pricing_estimates_v1`.

Lower priority: technician-side address on the pickup leg (currently
phone-coordinated; dropoff fields empty on pickup tasks), deleting the
deprecated direct-claim helpers, manual device smoke of
courier signup → approval → task before the next store build.

## 9. Operating rules for future sessions

- After every codebase change: **commit AND push** to origin/main.
- Never add direct INSERT/UPDATE RLS policies on `order_offers` /
  `delivery_tasks` — all writes via the RPCs.
- Don't re-apply the three migrations above (already on remote).
- Run `npx tsc --noEmit` and `npx jest --forceExit` directly (no `timeout`
  wrapper on this machine).
- EAS project: `fixate`, projectId `a680cf7b`; verify iOS builds locally
  (xcodebuild simulator) before spending an EAS build credit.
