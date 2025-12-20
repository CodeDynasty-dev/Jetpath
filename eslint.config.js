import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist',
      'docs/build',
      'node_modules',
      '.git',
      'example',
      'jetpath-cradova',
      'bundle.ts',
      'definitions.jet.ts',
      '*.min.js',
      'src/assets',
      'src/assets/bundle.ts',
      'docs/assets/prism.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      '@typescript-eslint/no-unnecessary-type-constraint': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-useless-escape': 'warn',
      'no-unsafe-finally': 'warn',
    },
  },
];
