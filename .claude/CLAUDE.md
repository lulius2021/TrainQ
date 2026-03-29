# TrainQ – Projektspezifischer Kontext

## Was TrainQ ist
iOS Fitness App mit adaptivem Training, Gamification (XP/Level),
Kalender, Gym/Running/Cycling Support, Free/Pro Tier.
Launch Ende März 2026. App Store noch nicht live.

## Architektur
- React 19 + TypeScript + Vite (rolldown-vite)
- Tailwind CSS + Framer Motion
- Capacitor 8 (iOS Native Bridge)
- Zustand (State Management)
- Supabase (Backend)
- i18next (i18n — DE/EN)

## Wichtige Regeln
- Nie Dateien löschen ohne explizite Bestätigung
- Immer prüfen ob neue Strings in src/i18n/locales/de.json + en.json eingetragen sind
- Keine hardcoded deutschen/englischen Strings — immer i18n-Keys via t("key") nutzen
- Vor jedem größeren Refactor kurz fragen
- Dev Server starten: `node node_modules/.bin/vite --port 5173 --host 0.0.0.0`
- TypeScript check: `node_modules/.bin/tsc --noEmit`

## Bekannte Probleme
- Raw Localization Key: adaptive.reason.recovery_good muss gefixt werden
- Große Monolith-Komponenten: LiveTrainingPage.tsx (~1400 Zeilen), TrainingsplanPage.tsx (~2500 Zeilen)

## Launch Status
- App Store Submission: Ende März 2026
- Offene Punkte: Bugs, UI Polish, Haptics, Lokalisierung
