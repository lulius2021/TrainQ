# TrainQ Fastlane Setup

## Voraussetzungen

- Ruby (via Homebrew: `brew install ruby`)
- Bundler: `gem install bundler`
- Xcode + Command Line Tools
- Apple Developer Account

## Einrichtung

```bash
cd ios/App

# Dependencies installieren
bundle install

# Environment Variables konfigurieren
cp fastlane/.env.example fastlane/.env
# .env mit eigenen Werten fuellen

# Certificates syncen (nach Match-Repo Einrichtung)
bundle exec fastlane sync_certs
```

## Lanes

### TestFlight Beta

```bash
bundle exec fastlane beta
```

Baut die Web-Assets, erhoeht die Build-Nummer, erstellt die IPA und laedt sie zu TestFlight hoch.

### App Store Release

```bash
bundle exec fastlane release
```

Erhoeht die Patch-Version (z.B. 1.0.0 → 1.0.1), baut und laedt zum App Store hoch.

### Nur lokal bauen

```bash
bundle exec fastlane build_only
```

Baut die App ohne Upload — zum lokalen Testen.

### Certificates syncen

```bash
bundle exec fastlane sync_certs
```

Holt Development- und AppStore-Certificates via match.

## Match Setup

1. Privates Git-Repo fuer Certificates anlegen
2. Repo-URL in `fastlane/Matchfile` eintragen
3. `bundle exec fastlane match init` ausfuehren
4. `bundle exec fastlane sync_certs`

## App Store Connect API Key

Fuer CI/CD wird ein API Key empfohlen statt Passwort-Auth:

1. Key erstellen: https://appstoreconnect.apple.com/access/integrations/api
2. `.p8` Datei sicher speichern (nicht committen!)
3. Key-Daten in `.env` eintragen

## Troubleshooting

- **Code Signing Fehler**: `bundle exec fastlane match nuke distribution` und dann `sync_certs`
- **Build Fehler**: Sicherstellen dass `npx cap sync ios` durchlaeuft
- **Upload Fehler**: Apple ID und Team ID in `.env` pruefen
