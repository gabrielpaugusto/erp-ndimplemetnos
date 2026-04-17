# ============================================================================
# Stage 1: Builder
# ============================================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN npm install -g prisma@6.4.0 && prisma generate --schema packages/db/prisma/schema.prisma

# Compila o pacote @erp/db para JavaScript (necessário em produção)
RUN pnpm --filter @erp/db build

# Build NestJS
RUN pnpm --filter @erp/api build

# ============================================================================
# Stage 2: Production
# ============================================================================
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Instala Prisma CLI e gera o client
RUN npm install -g prisma@6.4.0 && prisma generate --schema packages/db/prisma/schema.prisma

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copia o pacote db compilado (JavaScript, não TypeScript)
COPY --from=builder /app/packages/db/dist ./packages/db/dist

# Força main a apontar para dist (não src) — ignora cache
RUN sed -i 's|"main": "./src/index.ts"|"main": "./dist/index.js"|g' packages/db/package.json && \
    sed -i 's|"types": "./src/index.ts"|"types": "./dist/index.d.ts"|g' packages/db/package.json

# Create non-root user
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs
USER nestjs

EXPOSE 3001

# Sincroniza o schema com o banco antes de iniciar a API
CMD ["sh", "-c", "prisma db push --schema packages/db/prisma/schema.prisma --skip-generate && node apps/api/dist/main.js"]
