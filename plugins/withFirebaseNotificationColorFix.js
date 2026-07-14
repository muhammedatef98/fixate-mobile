// Resolves an Android manifest-merger conflict between expo-notifications and
// @react-native-firebase/messaging. Both declare the meta-data
//   com.google.firebase.messaging.default_notification_color
// (expo-notifications -> @color/notification_icon_color, our green brand color;
//  RNFirebase messaging -> @color/white), and the merger refuses to choose.
// We add tools:replace="android:resource" so the app's value wins, keeping the
// branded notification color. Same for default_notification_icon, which RNFirebase
// also declares, to pre-empt the next merge conflict.
//
// MUST BE LISTED FIRST in app.json's `plugins` array. Expo executes
// withAndroidManifest mods in REVERSE registration order — the last plugin
// registered runs first — so being first in the list is what makes this mod run
// LAST, after expo-notifications has written the meta-data we need to annotate.
// Listed anywhere else it runs too early, finds no meta-data, silently does
// nothing, and the Android build dies in :app:processDebugMainManifest.
const { withAndroidManifest } = require('expo/config-plugins');

const TOOLS_NS = 'http://schemas.android.com/tools';
const OVERRIDDEN_META = new Set([
  'com.google.firebase.messaging.default_notification_color',
  'com.google.firebase.messaging.default_notification_icon',
]);

module.exports = function withFirebaseNotificationColorFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = TOOLS_NS;

    const application = manifest.application?.[0];
    if (!application) return cfg;

    const metaData = application['meta-data'] || [];
    for (const meta of metaData) {
      const name = meta.$?.['android:name'];
      if (!OVERRIDDEN_META.has(name)) continue;
      const attr = meta.$['android:resource'] != null ? 'android:resource' : 'android:value';
      meta.$['tools:replace'] = attr;
    }
    return cfg;
  });
};
