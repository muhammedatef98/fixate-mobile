// B-10: dynamic Expo config that hydrates the Google Maps Android API key
// from an EAS Secret instead of hard-coding it in app.json (which is
// version-controlled). Everything else is sourced verbatim from app.json.
//
// EAS Secret name expected (set once per project, never committed):
//     GOOGLE_MAPS_ANDROID_API_KEY
//
// Set via either:
//   eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_API_KEY \
//     --value '<your-key>'
// or:
//   EAS dashboard → Project → Secrets → Add → key=GOOGLE_MAPS_ANDROID_API_KEY
//
// Local dev:
//   The key is only consumed by the native Android Maps SDK, so it is
//   ONLY required for Android production / preview builds. iOS uses
//   Apple Maps (PROVIDER_DEFAULT) and does not need it. Without the
//   secret, Android builds will still produce, but the map view will
//   show a gray tile + the standard "API key not found" log line, so
//   the build does not fail — only Maps is degraded.

const base = require('./app.json');

module.exports = ({ config: _expoIncomingConfig }) => {
  // `expo` block from app.json is the single source of truth for
  // everything except the Google Maps Android key. We shallow-merge
  // android.config.googleMaps without touching any other field.
  const expo = base.expo;

  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  const android = {
    ...expo.android,
    config: {
      ...(expo.android && expo.android.config ? expo.android.config : {}),
      // Only emit the googleMaps block when a real key is present.
      // Emitting `{ apiKey: undefined }` would still write the block to
      // AndroidManifest.xml with an empty value and confuse the SDK at
      // runtime, so we conditionally omit it instead.
      ...(mapsKey
        ? { googleMaps: { apiKey: mapsKey } }
        : {}),
    },
  };

  if (!mapsKey) {
    // Non-fatal hint so it shows during `eas build` / `expo prebuild`.
    // Keeps local dev unblocked while making the gap obvious.
    // eslint-disable-next-line no-console
    console.warn(
      '[app.config] GOOGLE_MAPS_ANDROID_API_KEY is not set. Android Maps will ' +
      'render a blank tile. Set the EAS secret before the next Android build.'
    );
  }

  return {
    ...expo,
    android,
  };
};
