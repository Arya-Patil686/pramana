# ─────────────────────────────────────────────────────────────────────────────
# PRAMĀNA — container image for Cloud Run
#
# Multi-stage so the runtime image carries no toolchain and no source. The
# standalone Next output bundles only the files the server actually reaches,
# which is what keeps a cold start on Cloud Run in the low hundreds of ms.
#
# No key material is baked in. On Cloud Run the Gemini calls authenticate as
# the runtime service account through Vertex (set GOOGLE_CLOUD_PROJECT); the
# remaining upstreams read their keys from Secret Manager at run time.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080

# Never run the server as root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
