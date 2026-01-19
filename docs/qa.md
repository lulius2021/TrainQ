# QA Checklist for Settings & Integrations

## Settings & UI
- [ ] **Theme Switching**
    - [ ] Toggle Light/Dark mode in Settings. Backgrounds and Texts update immediately.
    - [ ] Reload page. Theme persists.
    - [ ] Verify "white boxes" are gone in dark mode.
- [ ] **Unit Switching**
    - [ ] Toggle Metric/Imperial. Selection persists.
- [ ] **Notifications**
    - [ ] Toggle switches. State persists after reload.
- [ ] **Legal Links**
    - [ ] "Impressum", "Privacy", "Terms" open in new view (SPA nav).
    - [ ] Back button works on legal pages.
    - [ ] Footer links work on Dashboard.

## Internationalization (i18n)
- [ ] **Language Switching**
    - [ ] Toggle DE/EN. Texts update immediately.
    - [ ] Refresh page. Language persists.
    - [ ] Verify German chars (Umlaute) display correctly.

## Garmin Integration
- [ ] **Connect Flow**
    - [ ] Click "Connect Garmin". Redirects to `api/garmin/auth`.
    - [ ] (Manual) Verify it redirects to Garmin (or placeholder).
    - [ ] (Manual) Verify callback handles token (requires backend running).
- [ ] **Disconnect Flow**
    - [ ] Only visible if connected.
    - [ ] Click "Disconnect". Confirms and updates UI to "Not connected".

## Mobile / iOS Hardening
- [ ] **Safe Areas**
    - [ ] Settings page header not covered by notch.
    - [ ] Bottom padding handles home indicator.
- [ ] **Scroll**
    - [ ] No double scroll bars.
    - [ ] Swipe back works (internal logic).

## Build & Lint
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
