#!/bin/sh
set -e

echo "DiMovie API entrypoint"
echo "PORT=${PORT:-unset}"
echo "NODE_ENV=${NODE_ENV:-unset}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Link Postgres on Railway or add the variable."
  exit 1
fi

if [ -z "$REDIS_URL" ]; then
  echo "ERROR: REDIS_URL is not set. Link Redis on Railway or add the variable."
  exit 1
fi

echo "Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy

echo "Starting DiMovie API on PORT=${PORT:-4000}..."
exec node dist/main.js
