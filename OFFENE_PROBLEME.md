# Offene Probleme (aktueller Stand)

## P0 (kritisch, Release-Blocker)

1. **Speichern ist nicht atomar**
- `state.json`/`manifest.json` werden direkt geschrieben (kein `tmp + fsync + rename`).
- Risiko: Teilweise/kaputte Datei bei Crash oder abruptem Stop.

2. **Keine echte Single Source of Truth**
- App-State, Kirby-Content und Projekt-Snapshot laufen parallel.
- Bei Timing/Race kann Stand auseinanderlaufen (App zeigt A, Editor zeigt B).

3. **Server-Orchestrierung bleibt fragil**
- 3 Prozesse (Node, Vite, PHP) mit Port-/Restart-Abhängigkeiten.
- `php -S` ist für diese Last empfindlich.
- „Website nicht erreichbar“ kann weiterhin auftreten.

4. **Save/Open-Races nicht vollständig ausgeschlossen**
- Locking ist da, aber nicht transaktional über alle beteiligten Dateien/Schritte.
- Projektwechsel in ungünstigem Timing kann falschen Zustand laden/speichern.

## P1 (hoch, stark störend im Betrieb)

5. **Projekt-Historie / Duplikate / Active-Status**
- Verbesserungen vorhanden, aber nicht endgültig robust gegen Sonderfälle (Rename, stale history, Wechsel in kurzer Folge).

6. **Kanonisierung nicht komplett abgeschlossen**
- Artefakte (`default 2.txt` etc.) werden bereinigt, aber Legacy-/Migrationsfälle sind noch nicht vollständig abgesichert.

7. **Editor↔App-Sync ist event-/polling-basiert, nicht deterministisch**
- Kein harter, zentraler Commit-Punkt für „Seitenliste final“ über beide Systeme.
- Intermittente Abweichungen können wieder auftreten.

8. **Deploy-Pipeline hat Edgecases**
- ZIP-Trigger/Fallback-Pfade sind verbessert, aber Fehlerbilder (404/Timing/Pfad) sind nicht vollständig erschöpfend abgesichert.
- Kein echtes Delta-Deploy; immer Vollpaket.

9. **Publish-Status-Logik ist fragil**
- „Live schalten aktiv/inaktiv“ hängt an Signaturlogik; Fälle mit externen Änderungen/Kirby-only Änderungen sind riskant.

## P2 (mittel, UX/Operational)

10. **Recovery/Diagnose für User zu technisch**
- Bei Fehlern fehlt ein klarer, geführter Recovery-Flow in der UI (statt Terminal-/Serverwissen).

11. **Automatisierte Regression fehlt**
- Kein stabiler E2E-Regressionstest über:
  - Projekt öffnen/wechseln/speichern
  - Seiten-Sync App↔Editor
  - Preview
  - Live-Deploy
- Damit bleibt jedes „geht jetzt“ unsicher.

12. **Observability fehlt**
- Keine strukturierte Fehlertelemetrie/Session-Trace pro Projektlauf.
- Root-Cause bei Intermittenz bleibt schwer nachweisbar.
