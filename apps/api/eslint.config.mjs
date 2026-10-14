import { nestConfig } from '@carecircle/eslint-config/nest';

const config = [
  ...nestConfig,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];

export default config;
