import { join } from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Emits a self-contained server bundle with only the node_modules it actually
  // uses, which is what keeps the production image small (Phase 16).
  output: 'standalone',

  // The monorepo root, so standalone tracing picks up the workspace layout.
  outputFileTracingRoot: join(import.meta.dirname, '../../'),

  // The shared package ships compiled ESM; transpiling it keeps source maps
  // useful and avoids surprises if it ever gains modern syntax.
  transpilePackages: ['@portfolio/shared'],

  // Never leak the framework version to clients.
  poweredByHeader: false,

  sassOptions: {
    // Bootstrap 5.3 still uses `@import` internally, which Dart Sass 1.80+
    // deprecates. These are warnings from a dependency we do not control and
    // they drown out our own build output; silencing them keeps real warnings
    // visible. Remove once Bootstrap ships a `@use`-based build.
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  },

  typescript: {
    // A type error must fail the build. CI also runs `tsc --noEmit` separately.
    ignoreBuildErrors: false,
  },

  eslint: {
    // Linting runs as its own CI job; keep the build focused on compiling.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
