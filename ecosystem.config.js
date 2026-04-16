module.exports = {
  apps: [
    {
      name: 'erp-api',
      script: 'apps/api/dist/main.js',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        GOV_AMBIENTE: '2', // '1' = Produção | '2' = Homologação (testes)
        CERT_ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      },
      watch: false,
      autorestart: true,
    },
    {
      name: 'erp-web',
      script: './start-web.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
      },
      watch: false,
      autorestart: true,
    },
  ],
};
