# Fixatee — Session Log (April–May 2026)

A condensed transcript of the full multi-day session with Claude that took the
project from an exposed-keys MVP to a production-ready Saudi-market repair
platform.

## 1. Security incident & key rotation

- Discovered hard-coded Supabase URL + anon key inside `lib/supabase.ts`
  (committed history, public on GitHub).
- Rotated keys via Supabase dashboard → switched to publishable
  `sb_publishable_…` format; updated client to read from
  `EXPO_PUBLIC_SUPABASE_*` env vars only.
- Local `.env` updated, `.env` confirmed in `.gitignore`.
- Added 3 GitHub Actions secrets via `gh`: `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_TOKEN`.
- Pushed a marker commit; CI ran green (Test & Type Check + Android EAS Build).

## 2. Codebase review and core refactors

- Unified `OrderStatus` into `types/order.ts` — was previously defined 4
  different ways across `lib/supabase.ts`, `lib/supabase-api.ts`,
  `services/orderService.ts`, `contexts/RequestContext.ts`.
- Replaced hard-coded greeting "محمد" on home screen with `userProfile.name`.
- Replaced hard-coded Riyadh coordinates in available-orders with real GPS via
  `expo-location`.
- Added `utils/errorMessages.ts` to translate Supabase error codes (PGRST116,
  23505, 42501, etc.) into Arabic.
- Migrated form validation to `utils/validation.ts` (email, password, phone,
  description, price, coordinates).
- Added password reset & password update to `services/authService.ts`.

## 3. Supabase RLS hardening

Applied via `apply_migration`:
- `users` INSERT policy (so signup can create profile rows)
- `orders` UPDATE tightened to require user_id, technician_id match, or pending
- `orders` DELETE only allowed on own pending orders
- `reviews` UPDATE/DELETE on own rows + UNIQUE(user_id, order_id)
- `messages` UPDATE/DELETE on own rows
- `technicians` self-INSERT
- `orders.status` CHECK constraint covering full state machine
- Fixed `function_search_path_mutable` warnings on `handle_new_user`,
  `set_updated_at`, `cleanup_soft_deleted_records`, `user_has_role`
- Revoked EXECUTE on SECURITY DEFINER functions from `anon`
- Tightened storage buckets `avatars` (authenticated only) and `orders`
  (only customer or assigned technician can read)

## 4. Payments infrastructure

- Created `payments` table (provider, provider_payment_id, amount, currency,
  status enum, metadata, RLS read-own only — writes via service role).
- Created `services/paymentService.ts` wrapping `supabase.functions.invoke`.
- Deployed Edge Function `create-payment` that:
  - Verifies caller owns the order
  - Creates Stripe PaymentIntent with proper metadata
  - Inserts a `payments` row via service-role client
  - Returns `{ payment, clientSecret, publishableKey }`
- (Stripe key still pending — function returns clear error until configured.)

## 5. Push notifications (FCM v1)

- Rewrote `notify-technicians` Edge Function from legacy server-key to FCM
  HTTP v1 using service-account JWT.
- Required env vars: `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON`.

## 6. Real-time `RequestContext`

- Replaced in-memory mock with real Supabase query of pending orders + a
  `postgres_changes` realtime subscription that auto-refreshes on any insert
  / update / delete.
- Fixed name-collision bug in `(technician)/dashboard.tsx` and
  `available-requests.tsx` (state was named `requests`, shadowing the API
  import) — `requests.acceptOrder()` was actually calling `.acceptOrder` on
  an array, so the technician's accept button was completely broken.
- Made order assignment atomic with `eq('status','pending') AND
  is('technician_id', null)` to prevent double-assignment race.

## 7. UI/UX overhaul

- Form guards on `login`, `signup`: button disabled until valid, spinner on
  press, friendly Arabic errors via `getFriendlyError`.
- Migrated hard-coded color objects to `getColors(isDark)` so dark mode
  actually works on those screens.
- New `ErrorState` component with a retry button replaces silent failures
  on `orders` and `available-orders`.
- New `RTLIcon` component (`RTLIonicon`, `RTLMaterialIcon`) — wraps Ionicons
  and MaterialIcons and auto-mirrors directional names (chevrons, arrows) in
  RTL. Migrated 26 screens via Python script.
- `BottomNav` accessibility: `accessibilityRole="tab"`, `accessibilityLabel`,
  `accessibilityState.selected`, `accessibilityHint`.
- 19 back buttons across the app got `accessibilityRole="button"` +
  `accessibilityLabel='رجوع'`.
- Added Cairo font (400 / 600 / 700) via `@expo-google-fonts/cairo`,
  applied globally as default `fontFamily` for `Text` and `TextInput`.
- Onboarding rewritten: 4 slides instead of 3 (added "How does the app
  work?" step explaining the 3-step flow).
- Replaced Freepik external image URLs on home with local gradient cards.
- Skeleton loaders (`SkeletonOrderCard`) replace plain spinners on async
  screens.

## 8. Live tracking, ratings, offline, haptics

- New `technician_locations` table with RLS (technician writes own,
  customer reads only their active orders) + realtime publication.
- `services/locationTrackingService.ts`: `startBroadcastingLocation` /
  `subscribeToTechnicianLocation`. Wired into technician's
  `assignOrderToTechnician` so the customer can track on accept.
- `components/LiveTrackingMap.tsx`: react-native-maps with auto-fit and
  "LIVE" badge.
- `components/RatingModal.tsx` triggers automatically on
  `(customer)/orders` for any completed-and-unreviewed order — 5-star
  selection + comment, persisted via `services/reviewService.ts`.
- `components/OfflineBanner.tsx` mounted at root: red banner slides down
  when `@react-native-community/netinfo` reports no connectivity, with
  Retry button that calls `NetInfo.refresh()`.
- `utils/haptics.ts`: thin wrappers around `expo-haptics`. Tap feedback on
  BottomNav, accept-order button, OTP send, and rating star selection.
- Replaced 5-second polling on customer orders screen with realtime
  subscription on `orders` filtered by `user_id`.
- Stronger empty state: "اطلب صيانة الآن" CTA instead of "no orders".

## 9. Email OTP system (cost-free)

After Twilio SMS turned out to require paid Saudi SMS:
- Created `otp_codes` table (RLS no-policy = service-role only).
- Deployed `send-otp` Edge Function: generates 6-digit code, SHA-256
  hashes it, stores with 10-minute TTL, sends styled bilingual HTML email
  via Resend HTTP API.
- Deployed `verify-otp` Edge Function: rate-limits to 5 attempts, marks
  code used, finds-or-creates user via `auth.admin.createUser`, returns
  a magic-link `token_hash` that the client uses to establish a real
  session via `auth.verifyOtp({type:'magiclink', token_hash})`.
- Resend free tier: 3,000 emails/month, no domain verification needed
  using `onboarding@resend.dev`.
- Required Supabase secret: `RESEND_API_KEY` (the user's first key was
  pasted in chat and revoked; second key set via dashboard secrets).
- Client side: `services/customOtpService.ts`, `app/login-otp.tsx`
  (Email "FREE" tab + Phone tab), `app/forgot-password.tsx` (3-step wizard:
  email → code → new password).

## 10. Profile sub-screens (no more "Coming Soon")

- `/addresses` — add / edit / delete / set default; backed by
  `user_addresses` table with single-default trigger.
- `/wallet` — pulls from `payments` table, shows total spent + per-txn
  status mapped to friendly labels.
- `/notifications-settings` — toggles for push/email/sms/order_updates/
  promotions/technician_messages, persisted in `notification_preferences`.
- `/settings` — language, dark-mode toggle, password reset link, links
  to terms/privacy/contact, app version, plus an Admin section that only
  appears for users with `users.is_admin = true`.

## 11. Technician onboarding (Saudi-specific)

3-step wizard at `/technician-onboarding`:
1. Personal — full name, phone, **National ID/Iqama** (10-digit checksum
   validated; flags citizen vs resident), city
2. Professional — specialty (chip), years of experience, bio (≥20 chars)
3. Verification — **Saudi IBAN** (SA + 22 digits, ISO-13616 mod-97
   checked), ID photo upload (required), professional certificate
   (optional)

Documents go to private bucket `technician-docs`; RLS scopes each
folder to its owner. Submission flips
`technicians.verification_status` to `submitted`.

`/admin-verifications` for admins to approve/reject pending
submissions. `users.is_admin = true` flag controls access.

## 12. Auth bugs hunted down (in order)

1. Technician login redirected to role-selection — `technician-auth.tsx`
   was querying `.from('profiles')` but the table is `users`. Fixed
   table name + `maybeSingle()`.
2. Logout did nothing — three Supabase clients (`lib/supabase`,
   `lib/supabase-api`, `services/supabaseClient`) shared AsyncStorage but
   each held its own in-memory session and listener. Customer logout
   only signed out one client; AuthContext (services/supabaseClient)
   stayed authenticated and the auth guard bounced back to home.
3. Unified all clients: `lib/supabase` and `lib/supabase-api` now
   re-export the singleton from `services/supabaseClient`.
4. Even after unification, `signOut({scope:'local'})` sometimes didn't
   emit `SIGNED_OUT`. AuthContext.signOut now:
   - Clears React state (session/user/userProfile/isAuthenticated)
   - Calls supabase signOut (best-effort)
   - Reads ALL AsyncStorage keys and `multiRemove`s any starting with
     `sb-` or containing `supabase`/`auth-token`
5. Auth guard expanded to recognize all auth-route names; redirects
   logged-in users to their role's home, redirects logged-out users on
   protected routes to role-selection.

## 13. Order status state machine fix

UI offered 10 statuses (`pending`, `accepted`, `picking_up`, `diagnosing`,
`waiting_parts`, `repairing`, `testing`, `delivering`, `completed`,
`cancelled`) but DB CHECK constraint only had 8. Updates to
`waiting_parts` / `testing` failed with a generic "حدث خطأ".
- Migration extended `orders_status_check` to all 10.
- `types/order.ts`, `(customer)/orders.tsx`, `FloatingOrderStatus`,
  `order-details.tsx` timeline all updated with labels + colors + icons
  for the two new states.

## 14. Customer order details: prominent status + call button

- Replaced small status pill with a full-width hero card: status color
  background, big icon + status label (Arabic / English) + order
  number — readable at a glance.
- Call button now always rendered when a technician is assigned (not
  just when `technician_phone` is set). Falls back to fetching the
  phone from the `technicians` table on-demand; if still missing, shows
  a polite alert pointing to chat.

## 15. Social login

- Trimmed to Google + Apple + X (Twitter) — Facebook removed.
- X icon switched from old Ionicons "logo-twitter" bird to FontAwesome6
  `x-twitter` (the official mark).
- All three providers now appear on customer auth, signup, AND
  technician-auth screens.
- `services/socialAuthService.ts`: thin wrapper around
  `supabase.auth.signInWithOAuth` + `WebBrowser.openAuthSessionAsync`.
  Providers must still be enabled in Supabase Dashboard → Auth →
  Providers for the call to succeed.

## 16. Repo cleanup (final pass)

- Moved 24+ root-level `.md` files into `docs/{internal,setup,business}/`.
- Moved 6 root-level `.sql` files into `supabase/migrations/` with
  timestamp-prefixed names.
- Trimmed `README.md` to <200 lines (project description + quick
  start). Marketing/investor content moved to
  `docs/business/INVESTOR_SUMMARY.md`.
- Added `.editorconfig`, `.prettierrc`, `.nvmrc`.
- Added `.github/PULL_REQUEST_TEMPLATE.md` and
  `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md`.
- `package.json` got `lint`, `format`, `typecheck`, `test:ci` scripts +
  `engines.node`, repository URL, keywords, author.

## 17. Branding

- Replaced `splash.png` / `icon.png` / `adaptive-icon.png` /
  `notification-icon.png` / `favicon.png` / `fixate-logo-main.png` /
  `fixatee-logo.png` / `logo.png` with the new wrench-and-phone mark.
- Updated GitHub repo description to the Arabic tagline:
  "Fixatee — تطبيق صيانة الأجهزة الإلكترونية في السعودية…".

## 18. Test status

96 / 96 tests passing throughout. Single CI flow covers Test &
Type Check + Android EAS Build, both green on master.

## 19. Final state

- Branch: `master`
- Last commit reviewed in this log: `1e6836d` (chore: improve
  package.json scripts and metadata)
- Working tree clean.
- All work pushed to `https://github.com/muhammedatef98/fixatee-mobile`.
