// Guarantees android/app/src/main/res/values/colors.xml always defines
//   <color name="iconBackground">#ffffff</color>
// on every `expo prebuild`.
//
// Why this is needed: the generated adaptive-icon resource
// (mipmap-anydpi-v26/ic_launcher.xml) references @color/iconBackground for its
// <background>. When that color name is missing from colors.xml the Android
// build fails with:
//   ERROR: resource color/iconBackground not found in ic_launcher.xml
// `prebuild --clean` wipes the android/ folder, so any hand-edited colors.xml
// is lost — this plugin re-injects the color deterministically each run.
//
// We use the dedicated withAndroidColors mod + AndroidConfig.Colors so we MERGE
// into the colors.xml Expo generates (splashscreen_background, etc. are kept)
// rather than overwriting the whole file. assignColorValue is idempotent: it
// updates the existing <color> if present, otherwise appends it.
const { withAndroidColors, AndroidConfig } = require('expo/config-plugins');

// Keep in sync with android.adaptiveIcon.backgroundColor in app.json.
const ICON_BACKGROUND_COLOR = '#ffffff';

/**
 * @param {import('expo/config').ExpoConfig} config
 * @param {{ color?: string }} [props] Optional override for the icon background color.
 */
module.exports = function withAndroidIconBackgroundColor(config, props = {}) {
  const color = props.color || ICON_BACKGROUND_COLOR;
  return withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: 'iconBackground',
      value: color,
    });
    return cfg;
  });
};
