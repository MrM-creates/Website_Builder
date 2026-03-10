# Flider v1.0.0-rc2

Release Candidate vom 10.03.2026  
Tag: `v1.0.0-rc2`

## Kurzfassung

- RC2 ist der sign-off Kandidat nach finalen Stabilitaets- und Gate-Checks.
- Versionsanzeige ist jetzt in der App sichtbar (`v1.0.0-rc2` im Footer).
- Build, Smoke-Test und System-Health sind gruen.

## Enthalten

- Stabiler Projektfluss (Starten/Fortsetzen, Sync App↔Editor, Reopen).
- Vorschau- und Live-Flow konsistent.
- Deploy-Pipeline mit gehaertetem Medienhandling.
- Sichtbare Branding-Namen auf **Flider** vereinheitlicht.
- Release-Hardening bei Defaults/Credentials.

## Teststatus (Sign-Off)

- `npm run build`: erfolgreich
- `npm run smoke:projects`: erfolgreich
- `GET /api/system/health`: erfolgreich
- Manuelle E2E-Checks: erfolgreich
