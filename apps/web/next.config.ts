import { join } from 'node:path';
import type { NextConfig } from 'next';

/**
 * `next/image` needs every remote origin it will ever load from allow-listed
 * up front (docs/architecture/06 §9) — media is served from the API's own
 * origin (`/uploads/*`, docs/architecture/01 §3), never the web app's own.
 * Parsed from `NEXT_PUBLIC_API_URL` when set (the real deploy value), with
 * `localhost:4000` always included as the plain local-dev fallback so a
 * developer who never set the env var still sees images.
 */
function buildImageRemotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const patterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
    { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/uploads/**' },
  ];

  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      patterns.push({
        protocol: url.protocol === 'https:' ? 'https' : 'http',
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
        pathname: '/uploads/**',
      });
    } catch {
      // Malformed value — config/env.ts-equivalent validation for the web
      // app doesn't exist yet; falling back to just the localhost pattern
      // is the safe degrade rather than failing the whole build over it.
    }
  }

  return patterns;
}

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

  images: {
    remotePatterns: buildImageRemotePatterns(),
    formats: ['image/avif', 'image/webp'],
    // Next's image optimizer has its own SSRF guard, independent of
    // `remotePatterns`: it resolves the upstream hostname and rejects
    // anything that resolves to a private/loopback IP UNLESS this is set
    // (verified against a real 400 "url parameter is not allowed" —
    // `localhost` resolves to `127.0.0.1`, which trips it). The local API
    // (`npm run dev`'s default `API_INTERNAL_URL`/`NEXT_PUBLIC_API_URL`,
    // and this same setup in CI) always runs on `localhost`, so every
    // developer hits this, not just this one test run. Harmless to leave
    // on in production too — a real deployment's `NEXT_PUBLIC_API_URL`
    // is a public hostname, which never resolves to a private IP in the
    // first place, so this guard simply never applies there.
    dangerouslyAllowLocalIP: true,
  },

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

  experimental: {
    // This codebase already imports react-bootstrap by subpath everywhere it
    // controls the import site (`react-bootstrap/Button`, docs/architecture
    // component convention) — that alone doesn't stop the package's OWN
    // internal modules from re-importing their siblings through its barrel
    // `index`, which still pulls the whole component tree into the graph.
    // Verified empirically: this one entry measured ~42 KB gzipped off every
    // public route's first load (docs/phases/phase-12-report.md "Bundle
    // budget"). `@tanstack/react-query` and `react-hook-form` were tried the
    // same way and measured zero effect on the public routes (both are
    // already admin-only and correctly code-split away from them) — left out
    // rather than kept for a change that doesn't do anything.
    optimizePackageImports: ['react-bootstrap'],
  },

  // No top-level `eslint` key: Next.js 16 no longer recognises one (verified
  // against a real "Unrecognized key(s)" build warning) — lint already runs
  // as its own CI job independently of the build.
};

export default nextConfig;
