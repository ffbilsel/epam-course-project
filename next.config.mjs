/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["argon2", "better-sqlite3", "pino"],
  },
};

export default nextConfig;
