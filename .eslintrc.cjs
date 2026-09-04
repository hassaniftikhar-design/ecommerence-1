
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname
  },
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:eslint-comments/recommended',
    'next/core-web-vitals'
  ],
  overrides: [
    {
      files: ['.eslintrc.{js,cjs,ts,cts}', 'next.config.ts', 'seed.ts', 'jest.config.ts'],
      env: { node: true },
      parserOptions: { sourceType: 'script', project: null }
    },
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/jsx-filename-extension': 'off',
        'jsx-quotes': 'off'
      }
    },
    {
      files: ['testing/**/*.{ts,tsx}', 'jest.setup.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'import/order': 'off'
      }
    }
  ],
  ignorePatterns: ['.next/*', 'node_modules/*', 'prisma/*', 'app/generated/*', 'jest.config.js', 'jest.config.ts', 'next-env.d.ts'],
  rules: {
    'eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
    'comma-dangle': [
      'error',
      'never'
    ],
    quotes: ['error', 'single'],
    '@next/next/no-html-link-for-pages': 'off',
    'no-trailing-spaces': 'error',
    'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx'] }],
    'no-param-reassign': 0,
    'react/function-component-definition': 0,
    'react/require-default-props': 0,
    'react/forbid-prop-types': 0,
    'no-nested-ternary': 0,
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'no-underscore-dangle': 0,
    'react/jsx-props-no-spreading': 0,
    'jsx-a11y/label-has-associated-control': 0,
    'react/prop-types': 0,
    'react/react-in-jsx-scope': 'off',

    'eol-last': ['error', 'always'],
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1 }],

    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
    'import/prefer-default-export': 'off',
    'import/newline-after-import': ['error', { count: 1 }],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
        pathGroups: [
          { pattern: 'react', group: 'builtin', position: 'before' },
          { pattern: 'next/**', group: 'external', position: 'before' },
          { pattern: '~/**', group: 'internal' },
          { pattern: '@/**', group: 'internal' }
        ],
        pathGroupsExcludedImportTypes: ['react'],
        'newlines-between': 'always-and-inside-groups'
      }
    ]
  }
};
