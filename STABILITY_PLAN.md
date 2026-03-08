# Flatsite Stabilitätsplan (verbindlich)

Ziel: Stabilität vor Features.  
Regel: Es wird immer nur die aktuelle Phase bearbeitet, keine Parallel-Themen.

## Phase 0: Stabilitäts-Freeze (0.5 Tag)
- [x] Feature-Freeze im Branch setzen.
- [x] Einmaliger Snapshot/Backup aller Testprojekte erstellen.
- [x] Definierte Testdaten (`Alpha`, `Beta`) neu und sauber anlegen.

### Definition of Done
- [x] Nur Stabilitäts-Tickets offen.
- [x] Reproduzierbare Testbasis dokumentiert.

## Phase 1: Persistenz-Härtung (1 Tag)
- [x] Atomare Writes für `state.json`, `manifest.json`, `history.json`, `active-project.json` implementieren (`.tmp` + `fsync` + `rename`).
- [x] Recovery-Logik für liegengebliebene `.tmp` Dateien beim Start einbauen.
- [x] Einheitliche Save-Queue/Mutex pro Projekt für `create/save/open/current` erzwingen.

### Definition of Done
- [x] 1000 Save/Open-Zyklen ohne korruptes JSON.
- [x] Kein 0-Byte-File im Stresstest.
- [x] Alpha/Beta-Wechsel 50x ohne Seitenverlust.

## Phase 2: Single Source of Truth sauber trennen (1 Tag)
- [x] Verbindliche Regel im Code umsetzen:
- [x] Kirby-Content = Seitenstruktur/Seiteninhalt.
- [x] `state.json` = Projektmetadaten (Hosting, UI, Publish-Status).
- [x] Beim Öffnen: kanonischer Read aus Kirby für Seitenliste, dann App-State setzen.
- [x] Bei Seitenänderung in App: nur über Sync-Endpunkt in Kirby schreiben.

### Definition of Done
- [x] Add/Rename/Reorder/Delete in App erscheint im Editor korrekt.
- [x] Änderung im Editor erscheint in App nach definiertem Refresh-Trigger.
- [x] Keine Geisterseiten in 30 Wiederholungen.

## Phase 3: Kanonisierung & Migration (0.5–1 Tag)
- [x] `sanitize` beim Projekt-Open ausführen (nicht global destruktiv beim Serverstart).
- [x] Reparaturregeln für `default 2.txt`-Artefakte, Legacy-Ordner und Reihenfolge-Ordner finalisieren.
- [x] Bei Konflikten immer Backup (`_recovery`) statt Löschen.

### Definition of Done
- [x] Bekannte Altprojekte öffnen ohne Seitenverlust. (N/A: aktuell keine Altprojekte im Bestand)
- [x] Keine falschen Templates mehr (`default 2` etc.).
- [x] Jede Reparatur wird mit Projekt-ID geloggt.

## Phase 4: Server-Manager vereinheitlichen (1 Tag)
- [x] Ein Startmodell als Standard festlegen (kein Mischbetrieb).
- [x] Health-Checks für Node/Vite/PHP + klaren Recovery-Path definieren.
- [x] Safe-Mode UI bei Backend-Ausfall implementieren.

### Definition of Done
- [x] 20 Start/Stop-Zyklen ohne Port-Leichen.
- [x] Bei Ausfall klare Meldung + "Diagnose starten".
- [x] Kein unkontrollierter Prozess-Kill im Normalpfad.

## Phase 5: Projektidentität robust machen (0.5 Tag)
- [x] UUID als Primär-ID erzwingen; Pfad nur als Attribut.
- [x] History deduplizieren nach UUID.
- [x] Active-Status nur über UUID führen.

### Definition of Done
- [x] Umbenennen/Verschieben erzeugt keine Duplikate.
- [x] Aktiv-Marker ist immer korrekt.

## Phase 6: Deploy-Absicherung (1 Tag)
- [ ] Staging-Upload + validiertes Entpacken robust machen.
- [ ] Hostpoint-kompatiblen Swap/Fallback finalisieren (ohne Symlink-Zwang).
- [ ] Publish-Status erst nach verifiziertem Erfolg setzen.

### Definition of Done
- [ ] 10 Deploys hintereinander erfolgreich.
- [ ] Fehlerfälle liefern präzise Meldung.
- [ ] `Live schalten` bleibt nur bei echten Änderungen aktiv.

## Phase 7: Observability + Regression (1 Tag)
- [ ] Strukturierte Logs einführen (`logs/error.log`, `logs/events.log`) inkl. Projekt-ID.
- [ ] Playwright Smoke-Suite erstellen:
- [ ] Projekt öffnen
- [ ] Seite hinzufügen
- [ ] App/Editor-Abgleich
- [ ] Vorschau
- [ ] Deploy-Dry-Run

### Definition of Done
- [ ] Smoke-Suite grün vor jedem Merge.
- [ ] Jeder kritische Fehler mit Log-Trace nachvollziehbar.

## Go/No-Go vor neuen Features
- [ ] Alle DoD von Phase 1 bis 4 erfüllt.
- [ ] Ein voller Arbeitstag manuelle Nutzung ohne Datenverlust/Serverdown.
- [ ] Smoke-Suite 3x hintereinander grün.
