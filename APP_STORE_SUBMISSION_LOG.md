# Fixate — App Store & Google Play Submission Log

_Session date: 2026-06-14 → 2026-06-15_
_Stack: Expo SDK 54 / React Native 0.81 / EAS Build. Owner: `muhammedatef98`. EAS project: `@muhammedatef98/fixate` (projectId `a680cf7b-b1aa-468f-9bd7-6cd9f9e35726`)._

---

## TL;DR — current state

| Platform | Status | Next action (yours) |
|---|---|---|
| **iOS** | ✅ Build finished & valid (`3eb95317`, v1.0.0 build 5) | Run `eas submit -p ios` (interactive Apple login) → TestFlight |
| **Android** | ✅ AAB uploaded & accepted (versionCode 101) | Finish the testing release in Play Console (steps below) |

---

## Key identifiers (don't lose these)

| Thing | Value |
|---|---|
| App display name | **Fixate** (unchanged everywhere) |
| iOS bundle id | `com.fixate.app` |
| **Android package id** | **`com.fixatee.app`** (permanent — the Play app was created with it; invisible to users) |
| EAS project | `@muhammedatef98/fixate` / `a680cf7b-b1aa-468f-9bd7-6cd9f9e35726` |
| OTA updates URL | `https://u.expo.dev/a680cf7b-b1aa-468f-9bd7-6cd9f9e35726` |
| Firebase project | `fixate-7dd90` (project_number 286168603538) |
| Sentry | org `fixate`, project `react-native` (token set as EAS secret) |

### Signing keys
- **iOS:** Apple Distribution Certificate, SHA1 `73:05:5F:A7…` (EAS-managed, remote).
- **Android (THE upload key):** `secrets/fixatee-upload-key.jks`, alias `fixatee-key-alias`, **SHA1 `AB:E9:67:10:3F:79:08:D6:0B:33:36:C3:D3:BF:02:64:B0:67:B5:AD`**. Recovered from the old `fixatee` EAS project. `keyPassword == keystorePassword`. Wired in `credentials.json` (gitignored).
  - 🔐 **Back up `secrets/fixatee-upload-key.jks` + `credentials.json` off-machine.** Losing them = can't update the Android app (only recoverable via Google upload-key reset).
  - Dead-end keys to ignore: `fixate-upload-key.jks` (57:7B, password lost) and `fixate-app-upload.jks` (6D:65) — both rejected by Play.

---

## iOS journey

1. Slug ↔ projectId mismatch (`fixatee` vs `fixate`) was erroring every build at "Resolve build configuration" → created a fresh `fixate` EAS project.
2. Set EAS production env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public client vars).
3. Firebase `GoogleService-Info.plist` kept out of the public repo → uploaded as EAS **file secret** `GOOGLE_SERVICES_INFO_PLIST`, injected via `app.config.js`.
4. Build fixes: stale `pnpm-lock.yaml` (`pnpm install --lockfile-only`); `@sentry/cli` not hoisted under pnpm (`.npmrc` → `public-hoist-pattern[]=*@sentry/cli*`); `SENTRY_AUTH_TOKEN` added as EAS secret.
5. Recentered the iOS app icon (was 25px right / 16px low) → `assets/icon.png` (1024², no alpha).
6. ✅ Build `3eb95317` finished (v1.0.0, build 5).

**Remaining:** `eas submit -p ios --profile production --id 3eb95317-9a48-431e-adcc-e4c0d5840fc5` (Apple login + 2FA; lets EAS create the App Store Connect app and upload to TestFlight).

---

## Android journey (the long one)

Every Android failure traced back to **one root cause**: there is a single, pre-existing Play Console app whose package is permanently `com.fixatee.app`, with **Play App Signing locked to the `AB:E9…` upload key**, and which had already burned versionCodes up to ~21.

Failures and fixes, in order:
1. **`ERR_PNPM_OUTDATED_LOCKFILE`** (Install deps) → regenerated `pnpm-lock.yaml`.
2. **Keystore prompt** can't run with `--non-interactive` → switched Android to a **local keystore** (`credentialsSource: local`, `credentials.json`).
3. **Gradle: `No matching client … com.fixate.app`** → user registered `com.fixate.app` in Firebase; updated `GOOGLE_SERVICES_JSON` EAS file secret.
4. **Play: "signed with the wrong key"** (got 57:7B, expected AB:E9) → recovered the old fixatee keystore (`AB:E9…`) from EAS and pointed `credentials.json` at it.
5. **Play: "package must be `com.fixatee.app`" + "versionCode already used"** → realized the Play app is permanently `com.fixatee.app`; set package to `com.fixatee.app`, bumped versionCode.
6. **Gradle: `No matching client … com.fixatee.app`** (no such Firebase client exists) → **synthesized** a `com.fixatee.app` client in `google-services.json` (cloned the `com.fixate.app` client) so the build passes; updated the EAS secret.
7. ✅ Build **`4049b330`** — package `com.fixatee.app`, key `AB:E9…`, versionCode **101**, Firebase check passing — **uploaded & accepted.**

### Final Android config (do not change)
- Package: `com.fixatee.app`
- Sign with: `secrets/fixatee-upload-key.jks` (AB:E9)
- `google-services.json` must contain the synthetic `com.fixatee.app` client
- versionCode: keep incrementing above 101

### ⚠️ Known caveat
Android **push notifications for `com.fixatee.app` won't work** until `com.fixatee.app` is registered for real in Firebase project `fixate-7dd90`. The synthetic client only satisfies the build; it doesn't enable FCM. This is **optional and non-blocking** for testing.

---

## Play Console — finishing the testing release

Build is uploaded (versionCode 101). Two non-blocking warnings (app size; no deobfuscation file) — **safe to ignore** for testing; both are fixed later by enabling R8/ProGuard before the production release.

Three errors seen when creating the **Closed testing** release, and how to clear them (no rebuild needed):
- **"no app bundles" / "can't upgrade"** → the release is empty. In the release → **App bundles → Add from library → versionCode 101**.
- **READ_MEDIA_IMAGES photo policy** → fill the Photo & Video Permissions declaration. Use the ≤250-char justification:
  > Customers attach photos of their broken device when creating a repair request, and technicians upload ID and verification documents during onboarding. Selecting these images from the photo library is core to the repair and verification flows.
- (Tip: **Internal testing** is simpler than Closed testing for a first test — no review, up to 100 testers.)

> We kept `READ_MEDIA_IMAGES` rather than removing it because 7 screens gate on `ImagePicker.requestMediaLibraryPermissionsAsync()`; removing it risked breaking photo upload. If Google rejects the declaration, the fallback is migrating those flows to the Android photo picker (code change + rebuild + testing).

### Release notes (paste-ready)
```
<en-US>
Welcome to Fixate — the easy way to get your devices repaired in Saudi Arabia.
• Book a certified technician to your location
• Track your repair request in real time
• Transparent pricing and secure in-app payment
• Chat with support anytime
First release — thanks for testing!
</en-US>
<ar>
مرحبًا بك في Fixate — أسهل طريقة لإصلاح أجهزتك في السعودية.
• احجز فنيًا معتمدًا يصلك أينما كنت
• تابع حالة طلب الإصلاح لحظة بلحظة
• أسعار واضحة ودفع آمن داخل التطبيق
• تواصل مع الدعم في أي وقت
نسختنا الأولى — شكرًا لتجربتك!
</ar>
```

---

## Future releases (once first manual upload exists)
- **Android:** `eas submit -p android --profile production --latest` (after dropping a Play service-account key at `secrets/play-service-account.json`).
- **iOS:** `eas submit -p ios --profile production --latest` (after the first interactive submit stores the ASC API key).
- Always sign Android with the `AB:E9` keystore; keep the synthetic `com.fixatee.app` Firebase client.

## Open optional improvements
- Enable R8/ProGuard (`expo-build-properties`) before production → smaller app + uploads `mapping.txt` (clears both Play warnings).
- Register `com.fixatee.app` in Firebase to enable Android push.
- Pick one package manager (repo has both `package-lock.json` and `pnpm-lock.yaml`; EAS uses pnpm) to stop lockfile drift.
- Store listing copy + screenshots (App Store + Play, Arabic + English) — not yet done.
