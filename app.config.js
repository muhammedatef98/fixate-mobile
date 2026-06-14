// Extends the static app.json. Its only job is to source the Firebase config
// files from EAS "file" environment variables at build time so the secrets
// stay out of the (public) git repo. Locally, where the env vars are unset,
// it falls back to the gitignored files in the project root.
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
