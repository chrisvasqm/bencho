# Bencho

Run [k6](https://k6.io) load, stress and spike tests from a web UI. Each run keeps its totals and a per-second time series (latency percentiles, VUs, requests/s, errors).

## Getting started

You need Docker only.

```sh
git clone https://github.com/chrisvasqm/bencho.git
cd bencho
docker compose up -d --build
```

Open http://localhost:10004, pick a test type and click **Start load test** (or stress/spike). The default target `http://quickpizza:3333` is a demo app in the stack; any URL works.

Stop with `docker compose down` (add `-v` to delete stored runs).

| Service    | URL                    | Port var          |
| ---------- | ---------------------- | ----------------- |
| Frontend   | http://localhost:10004 | `FRONTEND_PORT`   |
| Backend    | http://localhost:10003 | `BACKEND_PORT`    |
| Postgres   | localhost:10002        | `POSTGRES_PORT`   |
| QuickPizza | http://localhost:10001 | `QUICKPIZZA_PORT` |

Limits: 1000 VUs, 20 stages, 60 minutes per run, 3 runs at a time. A run passes when error rate, p50/p90/p95/p99 latency and check pass rate (above 99%) all hold.

## Develop

Requires Node 24, pnpm and k6 (`brew install k6`).

```sh
docker compose up -d postgres quickpizza
cd backend && pnpm install && pnpm dev     # API on :10003
cd frontend && pnpm install && pnpm dev    # UI on :10004
cd frontend && pnpm storybook              # UI kit on :10006
```

`pnpm check` runs typecheck, lint, format and build in each project.

## Tests

Keep QuickPizza running; tests start real k6 runs. Tests use throwaway databases on `postgres-test` (:10005), so dev data is never touched.

```sh
cd backend && pnpm test:db && pnpm test     # integration (Vitest)
cd frontend && pnpm exec playwright install chromium   # once
cd frontend && pnpm test:e2e                 # e2e (Playwright)
```

CI runs checks and both suites on every PR.

## API

All routes are under `/api/v1`.

| Method | Path               | Purpose                                      |
| ------ | ------------------ | -------------------------------------------- |
| GET    | `/defaults`        | Default target, stages and limits            |
| POST   | `/runs`            | Start a run                                  |
| GET    | `/runs?type=`      | List runs (paged); `active=true` for running |
| GET    | `/runs/:id`        | One run with status and summary              |
| GET    | `/runs/:id/points` | Per-second points, live while running        |
| POST   | `/runs/:id/stop`   | Stop a run, keep partial results             |
| DELETE | `/runs/:id`        | Delete a finished run                        |
| POST   | `/runs/delete`     | Delete up to 50 runs by `ids`                |
