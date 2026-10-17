# SeatSeller

Android app that tracks resale prices near Capital One Arena section 109 (rows E1/E2) for every Wizards home game and sends notifications when it looks like time to sell.

- `web/` – the app UI (Capacitor web assets)
- `android/` – Android wrapper + native background price check (WorkManager) and notifications
- `data/prices.json` – price feed updated daily; the app and background worker read it from raw.githubusercontent.com
- Every push to `main` builds `SeatSeller.apk` via GitHub Actions and attaches it to the latest release.
