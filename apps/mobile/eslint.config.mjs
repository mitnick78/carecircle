import { reactNativeConfig } from '@carecircle/eslint-config/react-native';

const config = [
  ...reactNativeConfig,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];

export default config;
