// {
//     "root": true,
//     "parser": "@typescript-eslint/parser",
//     "parserOptions": {
//         "ecmaVersion": 6,
//         "sourceType": "module"
//     },
//     "plugins": [
//         "@typescript-eslint"
//     ],
//     "rules": {
//         "@typescript-eslint/naming-convention": "warn",
//         "@typescript-eslint/semi": "warn",
//         "curly": "warn",
//         "eqeqeq": "warn",
//         "no-throw-literal": "warn",
//         "semi": "off"
//     },
//     "ignorePatterns": [
//         "out",
//         "dist",
//         "**/*.d.ts"
//     ]
// }
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
