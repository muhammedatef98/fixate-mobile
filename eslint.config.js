const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['*.config.js', 'babel.config.js', 'metro.config.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', module: 'writable', require: 'readonly', process: 'readonly' },
    },
  },
  {
    ignores: [
      'dist/*',
      'android/*',
      'ios/*',
      'backups/*',
      'node_modules/*',
      'play-store-screenshots/*',
      'scripts/*',
      'supabase/functions/*',
    ],
  },
]);
