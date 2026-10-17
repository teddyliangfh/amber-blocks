// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*', '.pnpm-store/*'],
  },
  {
    rules: {
      // House style (spec Code Style): readonly arrays are spelled ReadonlyArray<T>,
      // mutable ones T[].
      '@typescript-eslint/array-type': ['warn', { default: 'array', readonly: 'generic' }],
    },
  },
]);
