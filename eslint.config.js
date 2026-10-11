const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

/** RNTP lo importa solo l'adattatore: il resto passa dalla facciata del player. */
const RNTP_PATHS = [
  {
    name: '@rntp/player',
    message: "Il player si usa da '@/player': RNTP lo importa solo src/player/rntp.ts.",
  },
];
const RNTP_PATTERNS = [
  {
    group: ['@rntp/player/*'],
    message: "Il player si usa da '@/player': RNTP lo importa solo src/player/rntp.ts.",
  },
];

module.exports = defineConfig([
  globalIgnores(['.expo/*', 'android/*', 'dist/*', 'coverage/*']),
  expoConfig,
  prettierConfig,
  {
    ignores: ['src/player/rntp.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: RNTP_PATHS, patterns: RNTP_PATTERNS }],
    },
  },
  {
    // Nell'app il player e' solo `@/player`, anche con percorsi relativi:
    // contratto e adattatore restano interni.
    files: ['index.js', 'app/**', 'src/**'],
    ignores: ['src/player/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: RNTP_PATHS,
          patterns: [
            ...RNTP_PATTERNS,
            {
              regex: '(^|/)player/[^/]+$',
              message: "Si importa da '@/player', non dai suoi file.",
            },
          ],
        },
      ],
    },
  },
]);
