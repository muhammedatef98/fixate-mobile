// Makes the Sentry source-map upload SKIP (instead of failing the build) when
// no SENTRY_AUTH_TOKEN is present in the environment.
//
// Why: @sentry/react-native creates a separate finalizer task
//   <bundleTask>_SentryUpload_<release>_<dist>
// that runs `sentry-cli ... upload`. A raw `./gradlew` from android/ does NOT
// load .env.local, so the token is missing and the task dies with
//   "Auth token is required for this request"
// which fails the whole release build. EAS/CI set SENTRY_AUTH_TOKEN and upload
// normally — so we only want to skip when the token is genuinely absent.
//
// We append a small Groovy guard to app/build.gradle that disables ONLY the
// _SentryUpload_ task(s) when the token is unset. The JS bundle task is separate
// and keeps running, so the APK/AAB is still produced (just without uploaded
// source maps for that local build). prebuild regenerates build.gradle, so this
// plugin re-applies the guard every run.
const { withAppBuildGradle } = require('expo/config-plugins');

const ANCHOR = 'withSentryUploadSkipWhenNoToken';
const SNIPPET = `

// [${ANCHOR}] Skip Sentry source-map upload when SENTRY_AUTH_TOKEN is absent.
def __sentryAuthToken = System.getenv('SENTRY_AUTH_TOKEN')
if (__sentryAuthToken == null || __sentryAuthToken.trim().isEmpty()) {
    gradle.taskGraph.whenReady { graph ->
        graph.allTasks.findAll { it.name.contains('_SentryUpload_') }.each { uploadTask ->
            uploadTask.enabled = false
            uploadTask.project.logger.lifecycle(
                "[Sentry] SENTRY_AUTH_TOKEN not set — skipping source-map upload task '" + uploadTask.name + "'")
        }
    }
}
`;

module.exports = function withSentryUploadSkipWhenNoToken(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `withSentryUploadSkipWhenNoToken: expected app/build.gradle to be Groovy, got ${cfg.modResults.language}`
      );
    }
    if (!cfg.modResults.contents.includes(ANCHOR)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
