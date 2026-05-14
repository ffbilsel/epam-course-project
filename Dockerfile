# syntax=docker/dockerfile:1.7

# ── deps ────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# ── builder ─────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Drizzle migrations + seeds are run at boot, not at build, so the
# build container needs no database.
RUN npm run build

# ── runner ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATABASE_URL=file:/data/innovatepam.db

# unprivileged user owns /app and /data
RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs \
  && mkdir -p /data /app/data/uploads \
  && chown -R nodejs:nodejs /data /app

# next standalone bundle + static + public + drizzle migrations + helper scripts
COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nodejs:nodejs /app/src/db ./src/db
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs
VOLUME ["/data", "/app/data/uploads"]
EXPOSE 3000

# Bootstrap: apply Drizzle migrations against the mounted SQLite
# file at /data, then hand off to the standalone Next server.
CMD ["sh", "-c", "node node_modules/tsx/dist/cli.mjs src/db/migrate.ts && node server.js"]
