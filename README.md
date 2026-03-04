# Flatsite Local Development

## Start in foreground (for active development)

```bash
npm run dev
```

This starts:
- Frontend (Vite) on `http://127.0.0.1:5173`
- Backend (Node) on `http://127.0.0.1:3001`
- Kirby (PHP) on `http://127.0.0.1:8000`

If you close that terminal, all services stop.

## Start in background with auto-restart

```bash
npm run dev:bg:start
```

Useful commands:

```bash
npm run dev:bg:status
npm run dev:bg:logs
npm run dev:bg:stop
npm run dev:bg:restart
npm run dev:bg:doctor
```

`dev:bg:doctor` is the recovery command. It removes stale PID state, clears conflicting listeners on ports `3001`, `5173`, `8000`, and starts a clean service set.

Background runtime data:
- PIDs: `.runtime/pids`
- Logs: `.runtime/logs`
