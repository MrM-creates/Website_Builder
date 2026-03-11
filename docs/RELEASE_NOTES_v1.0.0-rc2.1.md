# Flider Release Notes – v1.0.0-rc2.1

Datum: 2026-03-11  
Branch: `codex/desktop-wrapper-bootstrap`

## Fokus dieses Release-Kandidaten

Stabilitaet und Recovery-Verhalten im Desktop-Betrieb (keine grossen Feature-Spruenge).

## Enthaltene Fixes

- Safe-Mode-Flow vereinfacht:
  - Auto-Reparatur zuerst
  - manuelle Eskalation erst bei Misserfolg
  - reduzierte Endnutzer-Texte
- Projektkontext beim Oeffnen gehaertet:
  - Autosave waehrend `Projekt oeffnen` blockiert, um State-Ueberschreiben zu verhindern
- Kirby-Start robust gemacht:
  - absoluter Router-Pfad statt relativer Pfad
  - Runtime-Self-Heal fuer fehlende Kirby-Core-Dateien
- Health-Checks gehaertet:
  - Kirby-Fatalantworten (`kirby/router.php` fehlend) werden als **unhealthy** erkannt

## Relevante Commits

- `8f8d385` fix(health): detect Kirby router fatal responses as unhealthy
- `5665b91` fix(kirby-start): use absolute router path and runtime self-heal
- `55f6a4f` fix(desktop-runtime): self-heal missing Kirby core files
- `d2faada` fix(project-open): block autosave while opening project
- `fdbc666` chore(safe-mode): simplify end-user recovery copy
- `6a6a6a5` refactor(safe-mode): auto-repair first, manual support escalation
- `4bc3e60` feat(safe-mode): auto-repair first, simplified recovery UX

## Verifikation

- `npm run build` erfolgreich
- `npm run smoke:projects` erfolgreich
- manueller Smoke-Test laut PO: "alles top"

## Artefakt

- DMG: `release/Flider-1.0.0-rc2-arm64.dmg`

## Hinweis

Lokale Projektinhalte unter `kirby-cms/content/*` sind nicht Teil dieses Release-Commits.
