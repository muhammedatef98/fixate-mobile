# Store Readiness — manual steps

Code is clean (typecheck + 48 tests green). Most prep is automated now; only
two items below need account access I don't have.

## What's already done

- ✅ Icons resized to store-spec resolutions (`icon.png` 1024×1024,
  `adaptive-icon.png` 1024×1024 with green safe-zone bg, `splash.png`
  1242×2436, `notification-icon.png` 256×256, `favicon.png` 64×64). Originals
  archived under `assets/_originals/` (gitignored). Replace any of these with
  hand-designed exports later if you want crisper output — these are valid
  for upload now.
- ✅ `delete-account` Edge Function deployed live (project `fixate`,
  ref `gpucisjxecupcyosumgy`, version 1, JWT verify on).
- ✅ Security advisors cleaned (revoked anon/authenticated EXECUTE on
  `user_has_role`; narrowed `storage.objects` policies on the `avatars`
  bucket so listing is no longer broad). Migration committed under
  `supabase/migrations/2026_05_03_harden_security_advisors.sql`.
- ✅ Hard-coded Supabase URL + JWT anon key removed from `app.json`.
- ✅ iOS `infoPlist`: camera/photos/location/mic strings + encryption flag
  + `LSApplicationQueriesSchemes`.
- ✅ Android: `READ_MEDIA_IMAGES` added; `RECORD_AUDIO` blocked.

## Still needs your hands (account access I don't have)

1. **Replace `REPLACE_WITH_APP_STORE_CONNECT_ID` in `eas.json`** with the
   numeric `ascAppId` from App Store Connect (Apple → My Apps → App
   Information → Apple ID).

2. **Place the Play service-account JSON at `secrets/play-service-account.json`**
   (path is gitignored). Generate it from Play Console → Setup → API access →
   create service account → grant "Release manager" role.

3. **Toggle on "Leaked password protection"** in Supabase Dashboard → Auth →
   Providers (HaveIBeenPwned check). Dashboard-only setting, can't be done
   from migration.

## Edge function secrets

Set on Supabase (`supabase secrets set …`, not committed):

- `SUPABASE_SERVICE_ROLE_KEY` — already required for `delete-account` and
  `notify-technicians`.
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` — for `create-payment`.
  Without these, payment screen still shows the "Coming Soon" alert
  (`app/payment.tsx:55`), so soft-launch without payments is fine.
- `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON` — for technician push.
- `RESEND_API_KEY` — for email OTP.

Then deploy the new function: `supabase functions deploy delete-account`.

## App Store / Play Console listing

- **Privacy URL:** already set to <https://fixate.site/privacy>. Page must be
  live before submission.
- **Account deletion:** wired via `delete-account` edge function. Apple
  Guideline 5.1.1(v) and Google Play policy now satisfied. Test on TestFlight
  before review submission.
- **Permissions strings:** added to `ios.infoPlist` for camera, photo library,
  location (when-in-use + always), microphone (declared unused). Android
  permissions match the manifest. `RECORD_AUDIO` is explicitly blocked.
- **Encryption export compliance:** `ITSAppUsesNonExemptEncryption: false`
  in `infoPlist` — only standard HTTPS, so the export-compliance form skips.

## What was fixed in this pass

- Hard-coded Supabase URL + JWT anon key removed from `app.json` (was
  committed publicly under `extra.supabaseUrl/supabaseAnonKey`).
- `eas.json` submit config rewritten — old path pointed to `/home/ubuntu/…`.
- iOS `infoPlist` privacy strings added (camera, photos, location, mic,
  encryption flag, `LSApplicationQueriesSchemes`).
- Android: `READ_MEDIA_IMAGES` added; `RECORD_AUDIO` blocked.
- `expo-image-picker` plugin block added with Arabic permission strings.
- All 52 TypeScript errors fixed (theme keys, missing API methods, shadowed
  state variables, expo-constants dependency, malformed payment style).
- Account-deletion flow now actually deletes the auth user via a new
  `delete-account` edge function (was previously soft-delete only — Apple
  rejects soft-delete).
- Technician available-orders screen now subscribes to realtime pending
  inserts (was TODO; relied on 30s polling).
- Profile screen used non-existent `logout` and `user.name` — now uses
  `signOut` and `userProfile.name` from the unified AuthContext.
- Chat screen referenced an undeclared `currentUserId` — now uses `user.id`.
