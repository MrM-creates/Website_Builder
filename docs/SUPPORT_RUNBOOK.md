# Flider Support Runbook (L1-L3)

Stand: 2026-03-11  
Gilt fuer: lokale Desktop-App (Entwicklung + produktiver Betrieb)

## 1. Ziel

Dieses Runbook definiert:

- wie Probleme erkannt werden,
- wer was bearbeitet (L1/L2/L3),
- wie Rollback ohne Datenverlust ausgefuehrt wird.

Prinzip: **erst stabilisieren, dann erweitern**.

Zugehoeriger Error-Code-Katalog:

- `docs/SUPPORT_ERROR_CODES.md`
- `docs/SUPPORT_DIAGNOSTICS_SCHEMA.md`

## 2. Rollen

- **L1 (User/App):** Diagnose starten, Dienst neu starten, Problem melden.
- **L2 (Support/Owner):** Triage nach Checkliste, Konfiguration pruefen, bekannten Fix anwenden.
- **L3 (Engineering):** Code-Fix, Hotfix-Build, Regression-Test, Release/rollback Entscheidung.

## 3. Incident-Meldeweg

## 3.1 Primaerer Kanal

- In-App Button: `Problem melden`
- App erzeugt ein Diagnosepaket und sendet es an eine Support-Adresse
  - Beispiel: `support@flider.app`

## 3.2 Sekundaerer Kanal

- Optional zusaetzlich Webhook (z.B. Slack/Discord) fuer Sofort-Alarm.

## 3.3 Wenn Versand fehlschlaegt

- Diagnosepaket lokal speichern
- `Diagnose kopieren` (Kurztext) fuer manuelle Mail

## 4. Preflight-Healthcheck (beim App-Start)

Beim Start laeuft ein kurzer Check (1-2 Sekunden):

1. Backend erreichbar (`/api/system/health`)
2. Kirby/PHP erreichbar
3. Projektordner schreibbar
4. Genug freier Speicherplatz
5. Keine stale Locks / defekten Sessions

Wenn ein Check fehlschlaegt:

- Kein Crash, sondern `Safe Mode` Screen
- Aktionen: `Dienste neu starten`, `Problem melden`, `Diagnose anzeigen`

## 5. Severity und SLA

- **P0 (kritisch):** Datenverlust, Projektkontamination, App nicht nutzbar  
  - Erstreaktion: <= 30 min  
  - Mitigation (Workaround oder Rollback): <= 2 h
- **P1 (hoch):** zentrale Funktion stoert stark (z.B. Publish dauerhaft fehlgeschlagen)  
  - Erstreaktion: <= 4 h  
  - Fix/Workaround: <= 1 Arbeitstag
- **P2 (mittel):** funktional vorhanden, aber fehlerhaft/unzuverlaessig  
  - Erstreaktion: <= 1 Arbeitstag  
  - Fix: im naechsten Patch-Release
- **P3 (niedrig):** UX/Text/Optik ohne Funktionsverlust  
  - Bearbeitung: nach Priorisierung

## 6. L1-Checkliste (User/App)

1. `Diagnose starten`
2. `Dienste neu starten`
3. Fehler reproduzieren
4. Falls weiter fehlerhaft: `Problem melden`

Pflichtdaten im Report:

- App-Version
- Betriebssystem
- Zeitstempel
- Projektname + Projekt-ID/Pfad
- konkrete Schritte bis zum Fehler

## 7. L2-Checkliste (Support)

1. Incident severity (P0-P3) setzen
2. Logs und Diagnosepaket lesen
3. Known-Issue-Match pruefen
4. Schnellfix anwenden (Config/Reset/Recovery-Schritt)
5. Wenn nicht loesbar: an L3 eskalieren (inkl. Paket + Repro)

## 8. L3-Checkliste (Engineering)

1. Reproduzieren in sauberer Umgebung
2. Fix auf Branch
3. Regression auf Kernfluesse:
   - Projekt oeffnen/wechseln
   - Seiten App <-> Editor Sync
   - Vorschau
   - Live schalten
4. Hotfix-Build
5. Freigabe oder Rollback

## 9. Rollback-Regeln

Rollback ist erlaubt, wenn P0/P1 nicht schnell stabilisiert werden kann.

- **App-Rollback:** auf letzte stabile Version `N-1` zurueck.
- **Projekt-Rollback:** letzten Snapshot vor fehlerhaftem Schritt wiederherstellen.
- **Deploy-Rollback:** letzten erfolgreichen Deploy-Stand (Manifest/Snapshot) aktivieren.

Wichtig: Ein kontrollierter Rollback ist besser als "weiter patchen" im laufenden Incident.

## 10. Betriebsregeln

1. Nie mehrere Probleme gleichzeitig fixen.
2. Erst Isolation, dann Fix, dann Test, dann naechster Punkt.
3. Jede Incident-Ursache kurz dokumentieren (Root Cause + dauerhafte Massnahme).
4. Nach jedem P0/P1: kurzer Postmortem-Eintrag in `docs/`.
