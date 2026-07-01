// Allows non-modular header includes inside framework modules for all Pod
// targets on iOS.
//
// Why: @react-native-firebase requires `use_frameworks! :linkage => :static`
// (see expo-build-properties ios.useFrameworks in app.json). Under static
// frameworks, RNFBApp is compiled as a clang framework module whose sources
// import non-modular React-Core headers (RCTConvert.h, RCTBridgeModule.h,
// RCTEventEmitter.h). Clang rejects that under
//   -Werror,-Wnon-modular-include-in-framework-module
// which failed the EAS "Run fastlane" / Xcode compile step. Setting
//   CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES
// on the Pods targets permits the includes.
//
// `prebuild --clean` regenerates ios/Podfile, so a hand-edit is wiped each run.
// This plugin re-injects the post_install loop deterministically and is
// idempotent (guarded by MARKER so repeated prebuilds don't stack it).
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';

const INJECT =
  '    # [withIosAllowNonModularIncludes] see plugins/withIosAllowNonModularIncludes.js\n' +
  '    installer.pods_project.targets.each do |target|\n' +
  '      target.build_configurations.each do |bc|\n' +
  "        bc.build_settings['" + MARKER + "'] = 'YES'\n" +
  '      end\n' +
  '    end\n';

module.exports = function withIosAllowNonModularIncludes(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile'
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes(MARKER)) {
        const anchor = 'post_install do |installer|\n';
        if (!contents.includes(anchor)) {
          throw new Error(
            '[withIosAllowNonModularIncludes] could not find post_install block in Podfile'
          );
        }
        contents = contents.replace(anchor, anchor + INJECT);
        fs.writeFileSync(podfilePath, contents);
      }

      return cfg;
    },
  ]);
};
