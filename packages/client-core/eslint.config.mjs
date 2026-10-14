import { libraryConfig } from '@carecircle/eslint-config/library';

const config = [
  ...libraryConfig,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];

export default config;
