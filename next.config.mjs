/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["argon2", "better-sqlite3", "pino"],
  },
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer) {
      // better-sqlite3 + argon2 are native Node addons; pino loads
      // transports lazily. Marking them external for the server
      // bundle (route handlers + instrumentation) prevents webpack
      // from trying to resolve `fs` / `path` for the edge target.
      const externals = config.externals;
      const additions = [
        "better-sqlite3",
        "argon2",
        "pino",
        "pino-pretty",
        "bindings",
        "node-gyp-build",
      ];
      if (Array.isArray(externals)) {
        config.externals = [...externals, ...additions];
      } else {
        config.externals = [externals, ...additions].filter(Boolean);
      }
    }
    if (nextRuntime === "edge") {
      // Defence in depth: even though `instrumentation.ts` guards
      // its bootstrap import with the literal
      // `process.env.NEXT_RUNTIME === "nodejs"` pattern, stub the
      // node-only built-ins so any future accidental edge-side
      // import surfaces as `undefined` rather than a build error.
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
        crypto: false,
        os: false,
        stream: false,
      };
    }
    return config;
  },
};

export default nextConfig;
