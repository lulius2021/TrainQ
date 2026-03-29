#!/bin/bash
# TrainQ Dev — startet alles für den Simulator
set -e

cd "$(dirname "$0")"

echo "→ Syncing Capacitor mit Dev-Server URL..."
CAPACITOR_DEV=1 node_modules/.bin/cap sync ios

echo "→ Starte Vite Dev-Server auf localhost:5173..."
node node_modules/.bin/vite --port 5173 --host 0.0.0.0
