#!/bin/bash
# TrainQ Auto-Push — läuft täglich via cron
LOG="$HOME/Documents/TrainQ/auto-push.log"
cd /Users/julius/Documents/TrainQ || exit 1

echo "[$(date '+%Y-%m-%d %H:%M')] Auto-push gestartet" >> "$LOG"

git add -A

if git diff --cached --quiet; then
  echo "[$(date '+%Y-%m-%d %H:%M')] Keine Änderungen — nichts zu pushen" >> "$LOG"
  exit 0
fi

git commit -m "chore: daily sync $(date '+%Y-%m-%d')"
git push origin main

echo "[$(date '+%Y-%m-%d %H:%M')] Push erfolgreich" >> "$LOG"
