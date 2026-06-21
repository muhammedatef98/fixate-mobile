module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo already transforms class fields and #private members
    // with the correct settings for the Expo SDK 54 / Hermes target.
    //
    // Do NOT add explicit @babel/plugin-transform-class-properties /
    // -private-methods here: layering them on top of the preset double-processes
    // react-native's own classes and crashes at runtime —
    //   • loose: true  → "Cannot assign to read-only property 'NONE'"
    //                    (expo-modules-core enum classes, at import)
    //   • spec mode    → "property is not configurable" (FlatList / VirtualizedList)
    // The preset alone is the supported, working configuration.
    presets: ['babel-preset-expo'],
  };
};
