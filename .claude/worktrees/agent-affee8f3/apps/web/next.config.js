/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' foi removido pois causa erro de symlink no Windows/OneDrive.
  // Reativar apenas se fizer deploy via Docker ou servidor Linux.
  // output: 'standalone',
  transpilePackages: ['@erp/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};
module.exports = nextConfig;
