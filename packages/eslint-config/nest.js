import globals from 'globals';

import { baseConfig } from './base.js';

const frameworkImports = {
  group: ['@nestjs/*', '@prisma/*', 'prisma', '.prisma/*'],
  message: 'Domain and application layers must stay framework-free (see ARCHITECTURE.md §3).',
};

const outerLayerImports = {
  group: ['**/infrastructure/**', '**/interface/**', '**/*.module', '**/*.module.js'],
  message: 'Inner layers never import outer layers (see ARCHITECTURE.md §3).',
};

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
  // Hexagonal dependency rule: domain <- application <- infrastructure / interface.
  {
    files: ['src/modules/*/application/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [frameworkImports, outerLayerImports] },
      ],
    },
  },
  {
    files: ['src/modules/*/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            frameworkImports,
            {
              group: [...outerLayerImports.group, '**/application/**'],
              message: 'The domain imports nothing outside itself (see ARCHITECTURE.md §3).',
            },
          ],
        },
      ],
    },
  },
];

export default nestConfig;
