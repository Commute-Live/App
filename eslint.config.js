const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'coverage/**',
      'dist/**',
      'build/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tseslint.parser,
      globals: {
        __DEV__: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        test: 'readonly',
        it: 'readonly',
        process: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-console': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['lib/datadog.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
