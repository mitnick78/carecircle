import globals from 'globals';

import { baseConfig } from './base.js';

/** NestJS API. */
export const nestConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // NestJS modules are decorated empty classes by design.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
];

export default nestConfig;
