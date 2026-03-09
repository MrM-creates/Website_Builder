# Flider Handoff (Current System)

## Architecture

- Frontend: React/Vite (`src/App.jsx`)
- Backend: Node.js (`server.js`)
- CMS engine/editor: Kirby in iframe (`kirby-cms/`)
- Dev ports:
  - Frontend: `5173`
  - Backend: `3001`
  - Kirby/PHP: `8000`

## Core flows

1. Onboarding defines project metadata, pages, design, hosting.
2. Editor step embeds Kirby panel (`/panel`) for content editing.
3. Local preview opens local rendered output.
4. Publish packages output and deploys via FTP flow.

## Current release policy

- Stable branch: production-ready features only.
- Experimental UI (Canvas concept) documented, not exposed in production.

## Important files

- Main app UI/state: `src/App.jsx`
- Backend endpoints/deploy/session logic: `server.js`
- Kirby site config/blueprints: `kirby-cms/site/config/`, `kirby-cms/site/blueprints/`
- Canvas concept mockup: `docs/mockups/canvas-editor-mockup.svg`
- Release baseline doc: `docs/RELEASE_STATE.md`
- Canvas roadmap doc: `docs/CANVAS_ROADMAP.md`

## Deployment checklist

1. Verify hosting settings (server/user/password/target path/website URL).
2. Confirm local preview matches expected output.
3. Publish and wait for success state.
4. Open website from `Website ansehen` and verify content.
5. Reopen project and validate persisted state.

## Next stage (after deployment)

Start Canvas development in a separate workspace/branch with single-renderer architecture and Kirby-backed persistence.
