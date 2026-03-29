#!/bin/bash
# Prüft ob neue Strings korrekt lokalisiert sind
# Warnt wenn hardcoded deutsche oder englische Strings in TSX/TS-Dateien gefunden werden

FILES_CHANGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.(tsx?|ts)$")

if [ -z "$FILES_CHANGED" ]; then
  exit 0
fi

# Suche nach hardcoded deutschen Strings (Großbuchstabe + Umlaute/Wörter, nicht in Kommentaren)
HARDCODED=$(grep -rn '"[A-ZÄÖÜ][a-zA-ZäöüÄÖÜß ]*"' $FILES_CHANGED | grep -v "//")

if [ ! -z "$HARDCODED" ]; then
  echo "⚠️ Warnung: Mögliche hardcoded Strings gefunden:"
  echo "$HARDCODED"
  echo "Bitte i18n-Key via t(\"key\") nutzen und in de.json + en.json eintragen."
fi

exit 0
