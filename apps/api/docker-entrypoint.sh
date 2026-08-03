#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy

echo "Starting DiMovie API..."
exec node dist/main.js
