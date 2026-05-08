FROM node:22-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm@10
WORKDIR /app

# ── Development ───────────────────────────────────────────────────────────────
FROM base AS development
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/.npmrc ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY apps/api/prisma ./apps/api/prisma/
COPY packages/shared ./packages/shared/
WORKDIR /app/apps/api
RUN pnpm db:generate
EXPOSE 4000
CMD ["pnpm", "dev"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/.npmrc ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY apps/api ./apps/api/
COPY packages/shared ./packages/shared/
WORKDIR /app/apps/api
RUN pnpm db:generate && pnpm build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
RUN npm install -g pnpm@10
WORKDIR /app/apps/api
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./
EXPOSE 4000
CMD ["node", "dist/apps/api/src/index.js"]
