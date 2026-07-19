FROM node:22-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

# ── Development ───────────────────────────────────────────────────────────────
FROM base AS development
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json apps/web/.npmrc apps/web/tsconfig.json apps/web/next.config.js apps/web/tailwind.config.ts apps/web/postcss.config.js ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY packages/shared ./packages/shared/
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
# NEXT_PUBLIC_* vars are baked into the bundle at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG BACKEND_API_ORIGIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV BACKEND_API_ORIGIN=$BACKEND_API_ORIGIN
ENV NEXT_STANDALONE=true
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json apps/web/.npmrc ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY apps/web ./apps/web/
COPY packages/shared ./packages/shared/
WORKDIR /app/apps/web
RUN pnpm build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app/apps/web
ENV NODE_ENV production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
