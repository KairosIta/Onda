const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  globalIgnores(['.expo/*', 'android/*', 'dist/*', 'coverage/*']),
  expoConfig,
  prettierConfig,
  {
    // Nell'app il player e' solo `@/player`, anche con percorsi relativi:
    // contratto, backend e modulo nativo restano interni.
    files: ['index.js', 'app/**', 'src/**'],
    ignores: ['src/player/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)player/[^/]+$',
              message: "Si importa da '@/player', non dai suoi file.",
            },
            {
              regex: '(^|/)modules/onda-player(/|$)',
              message: "Il player si usa da '@/player': il modulo nativo lo importa src/player.",
            },
          ],
        },
      ],
    },
  },
]);
