const ignoreForTests = [ 'test/**/*' ]

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: [
    '@globalid',
    'jest',
  ],
  extends: [
    'plugin:@globalid/node-svc',
    'plugin:prettier/recommended'
  ],
  env: {
    node: true,
    jest: true,
    'jest/globals': true
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    "@typescript-eslint/no-extraneous-class": ['off'], //Nest has this pattern
    "@typescript-eslint/ban-types": ['off'],
    'no-restricted-imports': ['error', {
      patterns: [
        '*/dist/*'
      ]
    }],
    'no-warning-comments': ['error'],
  },
  overrides: [
    {
      files: ignoreForTests,
      rules: {
        'no-warning-comments': 'warn',
        '@typescript-eslint/no-empty-function': ['off'],
        'no-restricted-syntax': ['off'],
      }
    },
  ],
};
