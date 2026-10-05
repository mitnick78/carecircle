import { nestConfig } from '@carecircle/eslint-config/nest';

export default [
  ...nestConfig,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];
