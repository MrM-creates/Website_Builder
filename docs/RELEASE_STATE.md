# Flider Release State (Production Baseline)

Date: 2026-03-09
Branch: `codex/pages-ftp-fixes-2026-03-04`

## Scope Frozen for Deployment

This baseline is the stable production candidate. No experimental editor features are active in the UI.

## Included in this release

- Onboarding flow: project start/continue, naming, pages, design, hosting.
- Design system: 4 styles x 4 curated vibes.
- Local preview flow from editor toolbar (`Vorschau`).
- Live deployment via FTP/FTPES/SFTP with ZIP deploy + unzip trigger fallback.
- Website-open flow (`Website ansehen`) gated by successful publish state.
- Footer configuration in editor context with automatic copyright/year behavior on website output.
- Project persistence and history improvements (state + manifest handling as currently implemented).
- Header branding updates (`Flider.` wordmark alignment fixes).
- App footer line with dynamic year: `Designed with the power of AI · © {year} MrM`.

## Explicitly not included in this release

- Canvas prototype modal in production UI.
- Any new editor architecture changes beyond current Kirby-based workflow.

## Smoke test before release

1. Start app and open existing project.
2. Add/rename/reorder pages in app and verify in editor.
3. Change design/vibe and verify local preview.
4. Edit one page in Kirby editor and verify preview update.
5. Publish to provider and verify `Website ansehen` opens correct URL.
6. Reopen project and verify persistence (pages/design/footer/hosting state).

## Notes

- Canvas concept asset is kept for planning only: `docs/mockups/canvas-editor-mockup.svg`.
- Production branch should remain feature-frozen until deployment is signed off.
