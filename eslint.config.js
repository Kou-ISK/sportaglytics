const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const typescriptFiles = ['**/*.ts', '**/*.tsx'];
const sharedGlobs = [
  'src/components/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
  'src/utils/**/*.{ts,tsx}',
  'src/types/**/*.{ts,tsx}',
  'src/contexts/**/*.{ts,tsx}',
  'src/report/**/*.{ts,tsx}',
  'src/shared/**/*.{ts,tsx}',
];

module.exports = [
  {
    ignores: ['build/**', 'dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: typescriptFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_|^e$',
          varsIgnorePattern: '^_|^e$',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['electron/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: sharedGlobs,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/features/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['**/pages/**'],
        },
      ],
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}', 'src/App.tsx', 'src/main.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '../features/*/**',
            '../../features/*/**',
            '../../../features/*/**',
            '../../../../features/*/**',
            'src/features/*/**',
          ],
        },
      ],
    },
  },
];
