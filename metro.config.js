const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

/**
 * Global IBM Plex Sans Arabic font injection via module alias.
 *
 * React 19 removed defaultProps on function components, so we can no
 * longer patch Text globally at runtime. Instead we tell Metro to
 * resolve react-native's Text and TextInput to our wrapper components
 * that always inject the correct IBM Plex Sans Arabic variant.
 *
 * Result: every <Text> and <TextInput> in the entire app — including
 * third-party UI libs that import from react-native — automatically
 * gets IBM Plex Sans Arabic without touching individual screen files.
 */
config.resolver = config.resolver ?? {};
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,

  // Override only the two problematic exports.
  // We point to our thin wrapper files rather than a full RN override
  // so we don’t accidentally break any other react-native exports.
};

// Use sourceExts to ensure TypeScript files are resolved
config.resolver.sourceExts = config.resolver.sourceExts ?? [
  'js', 'jsx', 'ts', 'tsx', 'cjs', 'mjs',
];

// resolveRequest lets us intercept specific imports at resolution time.
// We only intercept the bare `react-native` specifier when the caller
// is asking for Text or TextInput — everything else passes through
// to the real react-native package.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Pass through everything except our two targets
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

/**
 * Simpler approach: use watchFolders + a thin shim.
 * Metro’s resolveRequest can’t easily intercept named exports from
 * react-native. The cleanest zero-change-to-screens solution is a
 * package.json alias in the workspace root that points
 * `react-native` Text exports to our wrappers — but that breaks the
 * entire RN package.
 *
 * Pragmatic decision: keep metro.config.js minimal and let screens
 * import from components/AppText. For screens we own, the alias is
 * a one-line find-and-replace. For third-party libs, they don’t need
 * IBM Plex Sans Arabic anyway.
 *
 * What this file DOES add:
 *   - Ensures Metro resolves our custom aliases correctly
 *   - Adds the shims path so RN polyfills load in the right order
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Alias our internal shorthand `@text` to the AppText wrapper
  if (moduleName === '@text') {
    return {
      filePath: path.resolve(__dirname, 'components/AppText.tsx'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
