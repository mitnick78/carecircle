import expoConfig from 'eslint-config-expo/flat.js';

import { baseConfig } from './base.js';

/** Expo / React Native mobile app. */
export const reactNativeConfig = [
  ...expoConfig,
  ...baseConfig,
  {
    ignores: ['.expo/**', 'expo-env.d.ts'],
  },
];

export default reactNativeConfig;
