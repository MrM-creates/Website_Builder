# Flider v1.0.0-rc1

Release Candidate vom 10.03.2026  
Tag: `v1.0.0-rc1`

## Highlights

- Stabiler End-to-End-Flow: Projekt starten/fortsetzen, Seiten anlegen, Design waehlen, Vorschau, Live schalten.
- App- und Editor-Sync fuer Seiten deutlich gehaertet (inkl. Projektwechsel und Reopen).
- Lokale Vorschau und Live-Website verhalten sich konsistent.
- Deploy-Pipeline verbessert: robustere Medienverarbeitung, optimierte Bildausgabe, weniger Altlasten bei Uploads.
- Branding in der UI auf **Flider** vereinheitlicht.

## Wichtige Verbesserungen

- Release-Hardening: keine sensiblen Test-Defaults mehr in Hosting-Feldern.
- Admin-Login gehaertet: keine statischen Klartext-Standard-Credentials mehr als feste Defaults.
- Persistenz/Projektfluss stabilisiert (Smoke-Test fuer Create/Open/Sync/Reopen).
- SEO-Description-Feld im Editor verbessert (inkl. Vorschlagslogik und sauberem UX-Flow).

## Teststatus

- `npm run build`: erfolgreich
- `npm run smoke:projects`: erfolgreich
- Manuelle Checks: App/Editor-Sync, Vorschau, Live-Schalten, Website ansehen positiv

## Hinweise zu diesem RC

- Dies ist ein **Release Candidate** zur finalen Abnahme, kein Final Release.
- Fokus des RC: Stabilitaet und verlässlicher Publishing-Flow.
- Groessere Ausbaustufe (Canvas-Editor) bleibt bewusst ausserhalb dieses RC.
