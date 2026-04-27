# =============================================================
# API Dockerfile (multi-stage)
# =============================================================
ARG NODE_VERSION=20.11-alpine

# ---- base ----
FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
RUN apk add --no-cache openssl

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile

# ---- dev ----
FROM deps AS dev
COPY . .
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["pnpm", "dev"]

# ---- build ----
FROM deps AS build
COPY . .
RUN pnpm --filter @brasa/db build && \
    pnpm --filter @brasa/shared-types build && \
    pnpm --filter @brasa/api build

# ---- prod ----
FROM node:${NODE_VERSION} AS prod
WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages ./packages
COPY --from=build /app/node_modules ./node_modules
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/index.js"]
