module.exports = function (api) {
  api.cache(true);

  // The Hermes compiler bundled with RN 0.81.5 (react-native/sdks/hermesc, and
  // the identical iOS Pods hermes-engine binary) is older than babel-preset-expo
  // assumes. Probing it shows it rejects exactly two constructs while accepting
  // everything else (generators, destructuring, spread, optional chaining, …):
  //   • `class` declarations        → "invalid statement encountered"
  //   • `async` arrow functions     → "async functions are unsupported"
  //     (it DOES support async function declarations and async methods — only
  //      the arrow form trips it, a known Hermes quirk)
  // The preset leaves both in (it targets a modern Hermes), so hermesc fails the
  // release build. We therefore down-level classes to ES5 and convert async
  // functions to generators (which hermesc supports natively — no
  // regenerator-runtime needed).
  //
  // This MUST run AFTER babel-preset-expo strips TypeScript and Flow. If it runs
  // earlier it rewrites classes while TS parameter properties (e.g.
  // `constructor(private options)` in expo's TextDecoder.ts) are still present,
  // producing invalid output the minifier rejects. Babel always runs plugins
  // before presets, so these transforms are wrapped in a preset and listed FIRST
  // in `presets` — presets execute in REVERSE array order, so this runs LAST,
  // after babel-preset-expo. At the preset level it also covers node_modules'
  // own classes/async (DOMRect, SyntheticError, KeyboardAvoidingView, …).
  const hermesDownlevelPreset = () => ({
    plugins: [
      '@babel/plugin-transform-classes',
      '@babel/plugin-transform-async-to-generator',
    ],
  });

  return {
    presets: [hermesDownlevelPreset, 'babel-preset-expo'],
    plugins: [
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
    ],
    overrides: [
      {
        include: /node_modules/,
        plugins: [
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
        ],
      },
    ],
  };
};
