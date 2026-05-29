/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable strict mode to prevent double renders in development
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'pg'],
  // swcMinify is now default in Next.js 16, no need to specify
  // Enable Turbopack config (Next.js 16 default)
  turbopack: {},
  webpack: (config) => {
    // Avoid issues with d3 imports
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
}

module.exports = nextConfig
