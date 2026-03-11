# Flider Diagnose-Protokoll (Schema)

Stand: 2026-03-11
Version: 1.0

## 1. Zweck

Dieses Dokument definiert das technische Diagnose-Protokoll fuer:

- In-App Diagnose (`Systemdiagnose starten`)
- Incident-Meldung (`Problem melden`)
- L2/L3 Triage und Root-Cause Analyse

Es basiert auf dem Error-Code-Katalog:

- `docs/SUPPORT_ERROR_CODES.md`

## 2. Payload-Name

- Typ: `diagnostic-report`
- JSON-Schema: `docs/schemas/diagnostic-report.schema.json`

## 3. Pflichtfelder

- `schemaVersion`
- `reportId`
- `timestamp`
- `app`
- `environment`
- `project`
- `incident`
- `services`
- `recovery`

## 4. Feldbedeutung (kurz)

- `app`: App-Name, Version, Build
- `environment`: OS, Runtime, locale/timezone
- `project`: aktiver Projektkontext
- `incident`: Error-Code + Severity + User-Message + Repro
- `services`: Health-Status von backend/frontend/kirby
- `recovery`: vorgeschlagene und ausgefuehrte Recovery-Schritte
- `attachments`: optionale Artefakte (Log-Dateien, Snapshot-Hinweise)

## 5. Beispiel-Payload

```json
{
  "schemaVersion": "1.0",
  "reportType": "diagnostic-report",
  "reportId": "d95d9f89-7f75-4af5-95a5-0c87f9ec4b9e",
  "timestamp": "2026-03-11T08:45:00.000Z",
  "app": {
    "name": "Flider",
    "version": "1.0.0-rc2",
    "build": "3c0b016",
    "channel": "stable"
  },
  "environment": {
    "os": "macOS 14.5",
    "arch": "arm64",
    "runtime": "electron",
    "locale": "de-CH",
    "timezone": "Europe/Zurich"
  },
  "project": {
    "id": "prj_7f8f4d",
    "name": "World of AI",
    "path": "/Users/MrM/Desktop/Flider projects/world-of-ai",
    "signature": "sha1:af9b5a...",
    "lastSavedAt": "2026-03-11T08:41:22.000Z"
  },
  "incident": {
    "errorCode": "SRV_UNHEALTHY",
    "severity": "P1",
    "message": "Kirby nicht erreichbar",
    "httpStatus": 0,
    "requestId": null,
    "reproSteps": [
      "Projekt geoeffnet",
      "Uebersicht aufgerufen",
      "Panel blieb leer"
    ],
    "startedAt": "2026-03-11T08:43:15.000Z"
  },
  "services": {
    "backend": {
      "up": true,
      "status": 200,
      "latencyMs": 38,
      "error": null
    },
    "frontend": {
      "up": true,
      "status": 200,
      "latencyMs": 31,
      "error": null
    },
    "kirby": {
      "up": false,
      "status": 0,
      "latencyMs": null,
      "error": "unreachable"
    }
  },
  "recovery": {
    "suggestedSteps": [
      "npm run dev:bg:ensure",
      "npm run dev:bg:status",
      "npm run dev:bg:logs"
    ],
    "actionsTried": [
      {
        "action": "restart-services",
        "at": "2026-03-11T08:44:10.000Z",
        "result": "failed"
      }
    ]
  },
  "attachments": [
    {
      "type": "log",
      "label": "dev-bg-status",
      "path": ".runtime/logs/dev-bg-status.log"
    }
  ]
}
```

## 6. Regeln

1. Keine stillen Feldaenderungen ohne `schemaVersion`-Update.
2. `errorCode` muss aus `docs/SUPPORT_ERROR_CODES.md` stammen.
3. Bei `severity = P0` ist `project.id` Pflicht, falls bekannt.
4. PII sparsam halten; keine Klartext-Passwoerter in Reports.
5. Versandfehler duerfen den App-Flow nicht blockieren.

## 7. Kompatibilitaet

- `1.x` ist abwaertskompatibel (neue optionale Felder erlaubt).
- Breaking Changes nur mit Hauptversionssprung (`2.0`, ...).

