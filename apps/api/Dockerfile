# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Skip browser download during npm ci — browsers are installed in the runner stage
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=api --workspace=@dimovie/shared --include-workspace-root

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build --workspace=@dimovie/shared \
  && npm exec --workspace=api -- prisma generate \
  && npm run build --workspace=api

# prune can drop/hoist workspace packages oddly; reinstall Prisma and regenerate
RUN npm prune --omit=dev \
  && npm install @prisma/client@5.22.0 prisma@5.22.0 --workspace=api --omit=dev \
  && npm exec --workspace=api -- prisma generate \
  && mkdir -p apps/api/node_modules \
  && cd apps/api && node -e "require('@prisma/client'); console.log('prisma client ok')"

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV VOICE_SFU_ENABLED=false
# Stable browser path used by both install and runtime (Railway)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Keep Chromium lean on Railway memory limits
ENV PLAYWRIGHT_SINGLE_PROCESS=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh /app/apps/api/docker-entrypoint.sh

RUN chmod +x /app/apps/api/docker-entrypoint.sh \
  && npm exec --workspace=api -- playwright install --with-deps chromium \
  && node -e "const {chromium}=require('playwright'); chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}).then(b=>b.close()).then(()=>console.log('playwright chromium ok'))"

WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["./docker-entrypoint.sh"]
