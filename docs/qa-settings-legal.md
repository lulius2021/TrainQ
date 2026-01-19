# QA: Settings & Legal

## Theme (Light/Dark)
- [ ] Toggle to **Dark Mode**: Background becomes dark, text becomes light.
- [ ] Toggle to **Light Mode**: Background becomes light, text becomes dark.
- [ ] **Persistence**: Refresh page. Theme should remain as selected.
- [ ] **Components Check (Dark Mode)**:
    - [ ] Settings Cards: No white background.
    - [ ] Modals (e.g., Paywall, Feedback): No blinding white backgrounds.
    - [ ] Inputs (Auth, Search): Text is readable, background appropriate.
    - [ ] Navbar/Footer: Consistent with theme.

## Language (DE/EN)
- [ ] Toggle **German (DE)**: UI strings change to German.
- [ ] Toggle **English (EN)**: UI strings change to English.
- [ ] **Persistence**: Refresh page. Language should remain as selected.
- [ ] **Formatting**: Dates and numbers format correctly for the locale.
- [ ] **Key Areas**: Settings, Navbar, Footer, Auth pages.

## Legal Pages
- [ ] **Impressum**:
    - [ ] Accessible via Settings > Legal > Imprint.
    - [ ] Accessible via Footer > Impressum.
    - [ ] Content matches: Julius Deusch, In den Grüben 140, 84489 Burghausen, Tel/Email correct.
- [ ] **Privacy (Datenschutz)**:
    - [ ] Accessible via Settings > Legal > Privacy.
    - [ ] Accessible via Footer > Privacy.
    - [ ] Content is visible and formatted.
- [ ] **Terms (AGB)**:
    - [ ] Accessible via Settings > Legal > Terms.
    - [ ] Accessible via Footer > Terms.
    - [ ] Content is visible and formatted.

## Settings Controls
- [ ] **Garmin**: Connect button redirects to auth (or shows alert if pending backend).
- [ ] **Notifications**: Toggles save state.
- [ ] **Units**: Metric/Imperial toggles save state.
- [ ] **Data**: Clear Calendar/History prompts before executing.
