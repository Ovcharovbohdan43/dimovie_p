#!/bin/sh
set -e

echo "========================================"
echo "DiMovie API entrypoint"
echo "PORT=${PORT:-4000}"
echo "NODE_ENV=${NODE_ENV:-unset}"
echo "DATABASE_URL set: $([ -n \"$DATABASE_URL\" ] && echo yes || echo NO)"
echo "REDIS_URL set: $([ -n \"$REDIS_URL\" ] && echo yes || echo NO)"
echo "========================================"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is missing."
  echo "In Railway: add Postgres plugin to this service, or paste DATABASE_URL."
  exit 1
fi

if [ -z "$REDIS_URL" ]; then
  echo "ERROR: REDIS_URL is missing."
  echo "In Railway: add Redis plugin to this service, or paste REDIS_URL."
  exit 1
fi

echo "Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy

echo "Starting Nest on 0.0.0.0:${PORT:-4000}..."
exec node dist/main.js
