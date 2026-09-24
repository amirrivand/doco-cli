import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  module: 'readonly',
  require: 'readonly',
  exports: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  process: 'readonly',
  console: 'readonly',
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.cursor/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],
  },
  prettier,
);
