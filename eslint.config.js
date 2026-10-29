// ESLint-configuratie voor de hele repo.
// De belangrijkste regels hier bewaken de architectuur:
//  - de engine (spelregels) mag niets uit React, de browser of Node gebruiken, en geen Math.random;
//  - de web-app mag alleen de publieke ingang van de engine importeren.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: [
      '*.{js,ts}',
      'packages/*/*.{js,ts}',
      'packages/server/**/*.ts',
      'packages/web/e2e/**/*.ts',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Spelregels: puur, deterministisch, zonder browser of React.
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['packages/engine/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'react/*'],
              message: 'De engine mag niets uit React importeren.',
            },
            {
              group: ['node:*', 'fs', 'path'],
              message: 'De engine moet ook in de browser draaien: geen Node-modules.',
            },
            {
              group: ['@wargame/web', '@wargame/server'],
              message: 'De engine kent de web-app en server niet.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'localStorage',
          'sessionStorage',
          'navigator',
          'fetch',
          'setTimeout',
          'setInterval',
          'performance',
        ].map((name) => ({
          name,
          message: 'De engine is puur: geen browser- of tijdsafhankelijke globals.',
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Gebruik de geseede generator (rng.ts), nooit Math.random.',
        },
        { object: 'Date', property: 'now', message: 'De engine mag niet van de klok afhangen.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'De engine mag niet van de klok afhangen.',
        },
      ],
    },
  },
  {
    // Web-app: React-regels, en alleen de publieke API van de engine.
    files: ['packages/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@wargame/engine/*', '**/engine/src/**'],
              message:
                'Importeer alleen uit "@wargame/engine". Spelregels horen in de engine, niet in de web-app.',
            },
          ],
        },
      ],
    },
  },
);
