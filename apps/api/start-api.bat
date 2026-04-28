@echo off
set "DATABASE_URL=postgresql://erp_dev_user:erp_dev_password@localhost:5432/erp_dev?schema=public"
set "JWT_SECRET=dev-jwt-secret-change-in-production"
set "JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production"
set "JWT_EXPIRES_IN=15m"
set "JWT_REFRESH_EXPIRES_IN=7d"
set "PORT=3001"
set "NODE_ENV=development"
set "CORS_ORIGIN=http://localhost:3000"
cd /d "C:\Users\Microsoft\OneDrive\Documentos\GitHub\novo teste\apps\api"
npm run dev
