#!/bin/sh
set -e

echo "========================================"
echo "DiMovie API entrypoint"
echo "PORT=${PORT:-4000}"
echo "NODE_ENV=${NODE_ENV:-unset}"
echo "PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-unset}"
if [ -n "$DATABASE_URL" ]; then echo "DATABASE_URL set: yes"; else echo "DATABASE_URL set: NO"; fi
if [ -n "$REDIS_URL" ]; then echo "REDIS_URL set: yes"; else echo "REDIS_URL set: NO"; fi
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
npm exec -- prisma migrate deploy

echo "Starting Nest on 0.0.0.0:${PORT:-4000}..."
exec node dist/main.js
