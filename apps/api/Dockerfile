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

# Gera o cliente Prisma na imagem de produção
RUN npm install -g prisma@6.4.0 && prisma generate --schema packages/db/prisma/schema.prisma

# Copy built application
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Create non-root user
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs
USER nestjs

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
