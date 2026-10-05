import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

import { baseConfig } from './base.js';

/** Next.js web app. */
export const nextConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  ...baseConfig,
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];

export default nextConfig;
