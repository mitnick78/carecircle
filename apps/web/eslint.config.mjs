import { nextConfig } from '@carecircle/eslint-config/next';

const config = [
  ...nextConfig,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];

export default config;
