// Extends the static app.json. Its only job is to source the Firebase config
// files from EAS "file" environment variables at build time so the secrets
// stay out of the (public) git repo. Locally, where the env vars are unset,
// it falls back to the gitignored files in the project root.
const fs = require('fs');
const path = require('path');

// FCM (Android push) requires google-services.json at the repo root for local
// builds. If neither the EAS env var nor the local file is present, FCM token
// registration will silently fail — surface it loudly at config-eval time.
// TODO: ensure google-services.json (package com.fixatee.app) exists before
// building locally, or set the GOOGLE_SERVICES_JSON EAS file secret for CI.
if (
  !process.env.GOOGLE_SERVICES_JSON &&
  !fs.existsSync(path.join(__dirname, 'google-services.json'))
) {
  console.error(
    '[app.config] google-services.json is MISSING — Android FCM push will not work. ' +
      'Add it to the repo root or set the GOOGLE_SERVICES_JSON EAS secret.'
  );
}

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_INFO_PLIST ?? config.ios.googleServicesFile,
  },
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile,
  },
});
