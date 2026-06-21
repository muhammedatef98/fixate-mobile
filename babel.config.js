module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // These transforms down-level `#private` fields/methods for older runtimes.
    // They MUST run in spec mode (NOT `loose`): `loose: true` enables
    // `setPublicClassFields`, which initializes class fields with plain
    // assignment ([[Set]]) instead of Object.defineProperty ([[Define]]).
    // That breaks libraries whose class fields shadow a read-only inherited
    // property — e.g. expo-modules-core enums like `AndroidImportance.NONE` —
    // throwing "Cannot assign to read-only property 'NONE'" at import time and
    // crashing the app. Spec mode ([[Define]]) defines an own property and is
    // safe.
    plugins: [
      '@babel/plugin-transform-private-methods',
      '@babel/plugin-transform-class-properties',
      '@babel/plugin-transform-private-property-in-object',
    ],
  };
};
