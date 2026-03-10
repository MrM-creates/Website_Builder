# React + Vite

## Desktop-Start (Electron Basis)

- `npm run desktop:dev` startet Flider in einem Desktop-Fenster.
- Auf macOS wird dafuer LaunchServices (`open -na`) genutzt, um Startprobleme mit direktem Electron-CLI zu vermeiden.
- Beim Start wird der lokale Stack (Backend 3001, Frontend 5173, Kirby 8000) automatisch geprueft und bei Bedarf gestartet.

Optional: Stack beim Schliessen der Desktop-App automatisch stoppen:

- macOS/Linux: `FLIDER_DESKTOP_STOP_STACK_ON_QUIT=1 npm run desktop:dev`
- Windows PowerShell:
  - `$env:FLIDER_DESKTOP_STOP_STACK_ON_QUIT='1'`
  - `npm run desktop:dev`

## Dev-Server stabil starten

Nutze fuer den lokalen Betrieb diese Befehle:

- `npm run dev:bg` startet Backend (3001), Frontend (5173) und Kirby (8000) im Hintergrund
- `npm run dev:bg:status` zeigt Live-Status und HTTP-Checks
- `npm run dev:bg:doctor` zeigt Diagnose + Recovery-Hinweise
- `npm run dev:bg:logs` zeigt die letzten Logs
- `npm run dev:bg:stop` stoppt alle drei Dienste sauber

Wenn `localhost:5173` nicht erreichbar ist:

1. `npm run dev:bg:stop`
2. `npm run dev:bg`

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
