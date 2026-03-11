# Flider Error-Code Katalog (L1/L2/L3)

Stand: 2026-03-11
Version: 1.0

## 1. Ziel

Dieser Katalog definiert einheitliche Fehlercodes fuer:

- In-App Diagnose (L1),
- Support-Triage (L2),
- Engineering-Eskalation (L3).

Jeder Incident soll mindestens einen Error-Code tragen.

## 2. Code-Schema

Format: `BEREICH_TYP`

- Bereich: `SRV`, `PRJ`, `SYNC`, `DEPLOY`, `AUTH`, `FS`, `CFG`, `PREVIEW`, `SEO`
- Typ: kurze Ursache, z.B. `DOWN`, `MISMATCH`, `WRITE_FAIL`

Beispiele:

- `SRV_DOWN`
- `PRJ_CONTEXT_MISMATCH`
- `DEPLOY_UPLOAD_FAIL`

## 3. Severity-Regel

- `P0`: Datenverlust, Projektkontamination, App unbenutzbar
- `P1`: zentrale Funktion blockiert (ohne Datenverlust)
- `P2`: Teilfunktion fehlerhaft, Workaround vorhanden
- `P3`: UX/Text/Optik

## 4. Standardfelder pro Incident

Pflichtfelder:

- `errorCode`
- `severity`
- `appVersion`
- `os`
- `timestamp`
- `projectId` (falls vorhanden)
- `projectPath` (falls vorhanden)
- `message`
- `reproSteps`

Optional:

- `requestId`
- `httpStatus`
- `stack`
- `lastKnownGoodVersion`

## 5. Kernkatalog

## 5.1 Server/Runtime

- `SRV_DOWN` (P0)
  - Trigger: Backend/Frontend/Kirby nicht erreichbar
  - L1: Diagnose starten, Dienste neu starten
  - L2: `dev:bg:status`, Ports/Logs pruefen
  - L3: Startsequenz/Orchestrierung fixen

- `SRV_UNHEALTHY` (P1)
  - Trigger: Healthcheck teilweise rot (ein Dienst down)
  - L1: Diagnose + Retry
  - L2: betroffenen Dienst gezielt neu starten
  - L3: Root Cause + Monitoring-Regel

- `SRV_RESTART_FAILED` (P1)
  - Trigger: automatischer Neustart der Dienste konnte nicht gestartet werden
  - L1: Diagnose erneut starten, App neu oeffnen
  - L2: `dev:bg:ensure` manuell pruefen, Logs lesen
  - L3: Restart-Orchestrierung fixen

## 5.2 Projekt/State

- `PRJ_CONTEXT_MISMATCH` (P0)
  - Trigger: Save mit falschem/missing `projectId`/`projectPath` (409/400)
  - L1: Projekt neu oeffnen, erneut speichern
  - L2: Incident markieren, keine weiteren Schreibaktionen erzwingen
  - L3: Kontextvalidierung/Locking pruefen

- `PRJ_SAVE_FAILED` (P1)
  - Trigger: `state.json`/`manifest.json` konnte nicht geschrieben werden
  - L1: Retry, ggf. anderes Projekt oeffnen
  - L2: Schreibrechte/Speicher pruefen
  - L3: atomare Save-Pipeline pruefen

- `PRJ_OPEN_FAILED` (P1)
  - Trigger: Projekt kann nicht geladen werden
  - L1: anderes Projekt oeffnen, dann retry
  - L2: Projektstruktur + Manifest validieren
  - L3: Open/Restore-Pfad fixen

- `PRJ_HISTORY_INCONSISTENT` (P2)
  - Trigger: Duplikate/falscher Aktiv-Status in Projektliste
  - L1: Liste aktualisieren
  - L2: History-Bereinigung ausfuehren
  - L3: Dedupe-Regeln anpassen

## 5.3 App <-> Editor Sync

- `SYNC_PAGES_MISMATCH` (P0)
  - Trigger: Seiten in App und Editor divergieren dauerhaft
  - L1: Projektwechsel und Reload
  - L2: Snapshot/Kanonisierung pruefen
  - L3: Sync-Quelle und Reihenfolge fixen

- `SYNC_FOOTER_MISMATCH` (P1)
  - Trigger: Footer-Werte gehen bei Projektwechsel verloren
  - L1: speichern + erneut oeffnen
  - L2: Save-Logs + project signature pruefen
  - L3: Save/Open race fixen

## 5.4 Deploy/Hosting

- `DEPLOY_CREDENTIALS_MISSING` (P1)
  - Trigger: Deploy blockiert wegen fehlender Pflichtfelder
  - L1: Felder pruefen/vervollstaendigen
  - L2: Feld-Mapping/Validation pruefen
  - L3: UI-Validation fix

- `DEPLOY_CONNECTION_FAIL` (P1)
  - Trigger: FTP/SFTP Verbindungsaufbau fehlgeschlagen
  - L1: Zugangsdaten + Port + Server pruefen
  - L2: Provider-spezifische Hinweise geben
  - L3: Verbindungsstack analysieren

- `DEPLOY_UPLOAD_FAIL` (P1)
  - Trigger: Upload bricht ab (FIN/timeout/SSL)
  - L1: Retry
  - L2: safe-mode fallback (ohne cleanup) pruefen
  - L3: Transport- und retry-logik haerten

- `DEPLOY_TRIGGER_404` (P2)
  - Trigger: unzip trigger nicht erreichbar (404)
  - L1: Fallback-Upload akzeptieren
  - L2: Website URL / Zielpfad pruefen
  - L3: Trigger-Strategie verbessern

- `DEPLOY_ASSET_MISSING` (P0)
  - Trigger: Live referenziert Asset, das auf Server fehlt (404)
  - L1: neu deployen
  - L2: Manifest/Materialisierung pruefen
  - L3: Export-/Asset-Pipeline fixen

- `DEPLOY_STALE_ASSETS` (P2)
  - Trigger: alte, nicht referenzierte Asset-Ordner bleiben erhalten
  - L1: normal weiterarbeiten
  - L2: cleanup-status pruefen
  - L3: stale-delete/manifest-cleanup optimieren

## 5.5 Auth/Panel

- `AUTH_SESSION_BUILD_FAIL` (P1)
  - Trigger: Auto-Login Session konnte nicht aufgebaut werden
  - L1: erneut versuchen
  - L2: session/cookie status pruefen
  - L3: session-builder fixen

- `PANEL_OFFLINE` (P1)
  - Trigger: Panel-Endpunkte nicht erreichbar
  - L1: Diagnose starten
  - L2: PHP/Kirby status pruefen
  - L3: server start/health path fixen

## 5.6 Filesystem/Config

- `FS_PERMISSION_DENIED` (P1)
  - Trigger: Schreiben im Projektordner nicht erlaubt
  - L1: Ordner mit Schreibrechten waehlen
  - L2: Rechte/Owner pruefen
  - L3: Fehlertext + Preflight verbessern

- `FS_DISK_LOW` (P1)
  - Trigger: zu wenig freier Speicher
  - L1: Speicher freigeben
  - L2: Grenzwert pruefen
  - L3: Preflight-Warnung haerten

- `CFG_INVALID` (P2)
  - Trigger: kaputte/inkonsistente Konfigdatei
  - L1: Projekt neu laden
  - L2: config validieren/reparieren
  - L3: schema validation + migration fix

## 5.7 Preview/SEO

- `PREVIEW_BLANK` (P1)
  - Trigger: Vorschau zeigt `about:blank` oder leer
  - L1: Vorschau neu oeffnen
  - L2: lokale URL/route pruefen
  - L3: preview routing stabilisieren

- `SEO_SUGGESTION_NOT_ENOUGH_CONTENT` (P3)
  - Trigger: Vorschlag nicht generierbar wegen zu wenig Inhalt
  - L1: erst mehr Seiteninhalt erfassen
  - L2/L3: keine Eskalation noetig

## 6. Mapping fuer UI

Userfreundliche Standardtexte:

- `SRV_DOWN`: "Server nicht erreichbar. Starte die Diagnose und versuche einen Neustart."
- `PRJ_CONTEXT_MISMATCH`: "Projekt-Kontext ungueltig. Bitte Projekt neu oeffnen."
- `DEPLOY_UPLOAD_FAIL`: "Upload fehlgeschlagen. Bitte Verbindung und Zugangsdaten pruefen."
- `DEPLOY_ASSET_MISSING`: "Ein Live-Bild fehlt. Bitte erneut live schalten."

## 7. Eskalationsregel

- Sofort L3 bei jedem `P0`.
- L2 loest `P1` selbst nur mit bekanntem Runbook-Schritt, sonst L3.
- `P2/P3` sammeln und im naechsten Patch bearbeiten.

## 8. Change-Regel

Neue Error-Codes nur mit:

1. Severity,
2. Trigger,
3. L1/L2/L3 Handlung,
4. User-Text.
