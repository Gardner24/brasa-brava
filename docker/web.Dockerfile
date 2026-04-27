# =============================================================
# Web Dockerfile (multi-stage)
# =============================================================
ARG NODE_VERSION=20.11-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile

FROM deps AS dev
COPY . .
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM deps AS build
COPY . .
RUN pnpm --filter @brasa/shared-types build && \
    pnpm --filter @brasa/web build

FROM nginx:1.27-alpine AS prod
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY docker/web.nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
