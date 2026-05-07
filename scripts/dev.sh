#!/bin/bash
# TrainQ Dev Server — clean start
# Usage: npm run dev:clean  OR  ./scripts/dev.sh
set -e
echo "Cleaning Vite caches..."
rm -rf node_modules/.vite .vite
echo "Starting dev server on http://localhost:5173"
exec node node_modules/.bin/vite --port 5173 --host 0.0.0.0
