/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' ativado automaticamente no Docker (NEXT_OUTPUT=standalone).
  // Localmente no Windows/OneDrive fica desativado para evitar erro de symlink.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
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
