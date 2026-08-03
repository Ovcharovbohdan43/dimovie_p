# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Skip browser download in builder — install Chromium only in runner
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=api --workspace=@dimovie/shared --include-workspace-root

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build --workspace=@dimovie/shared \
  && cd apps/api \
  && npx prisma generate \
  && npm run build

# Keep prisma CLI for migrate deploy; drop other devDependencies
RUN npm prune --omit=dev \
  && npm install prisma@5.22.0 --workspace=api --no-save --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Railway-ready default: P2P voice + TURN (SFU needs host UDP range)
ENV VOICE_SFU_ENABLED=false

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh /app/apps/api/docker-entrypoint.sh

# System libs + Chromium for Rezka catalog scraping
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && /app/node_modules/.bin/playwright install --with-deps chromium \
  && chmod +x /app/apps/api/docker-entrypoint.sh \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./docker-entrypoint.sh"]
