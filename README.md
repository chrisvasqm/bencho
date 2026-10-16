# Bencho

Load, stress and spike tests with [k6](https://k6.io), run from a web UI and stored per test type. Each run keeps its k6 totals and a per-second time series (latency percentiles, virtual users, requests/s, errors).

```
backend/    Express 5 API: starts k6 runs, stores them in Postgres. Owns the k6 scripts (backend/k6).
frontend/   React 19 + Vite UI: pick a target URL, shape the load, set limits, watch results. Storybook for the UI kit.
compose.yaml  QuickPizza (demo target), Postgres, backend, frontend.
```

## Getting started

You need Docker only. No `.env` or secrets.

```sh
git clone https://github.com/chrisvasqm/bencho.git
cd bencho
docker compose up -d --build
```

1. Open http://localhost:10004.
2. Pick a test type (load, stress or spike). Keep the default target `http://quickpizza:3333`, the demo app in the stack.
3. Click **Start load test** (or stress/spike) and watch the charts fill while the run is going.

The first build takes a few minutes. Later starts are fast. Stop with `docker compose down`. Add `-v` to also delete stored runs.

## Run the stack

Requires Docker.

```sh
docker compose up -d --build
```

| Service    | URL                    | Port var          |
| ---------- | ---------------------- | ----------------- |
| Frontend   | http://localhost:10004 | `FRONTEND_PORT`   |
| Backend    | http://localhost:10003 | `BACKEND_PORT`    |
| Postgres   | localhost:10002        | `POSTGRES_PORT`   |
| QuickPizza | http://localhost:10001 | `QUICKPIZZA_PORT` |

Inside the stack the demo target is `http://quickpizza:3333`; the form starts with it. Any other URL works too.

Ports follow `10SPP` (`S` = stack number, `PP` = service slot). Override with env vars or a root `.env`.

## Develop

Requires Node 24, pnpm, k6 (`brew install k6`).

```sh
docker compose up -d postgres quickpizza
cd backend && pnpm install && pnpm dev        # API on :10003, migrations run at start
cd frontend && pnpm install && pnpm dev       # UI on :10004, proxies /api to :10003
cd frontend && pnpm storybook                 # UI kit on :10006
```

Each project has `pnpm check` (typecheck, lint, format, build). CLI runs without the API: `cd backend && pnpm load|stress|spike` (see `backend/example.env`).

## API

| Method | Path                                 | Purpose                                                                                                     |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/defaults`                   | Default target, stages per type, limits                                                                     |
| POST   | `/api/v1/runs`                       | Start a run: `type`, `baseUrl`, optional `stages`, `thinkTimeSeconds`, `maxErrorRate`, `latencyLimitsMs`    |
| GET    | `/api/v1/runs?type=&page=&pageSize=` | One page of runs of a type, newest first, with `total`; `active=true` lists queued/running runs of any type |
| GET    | `/api/v1/runs/:id`                   | One run with status (`queued`, `running`, `passed`, `failed`, `stopped`, `error`) and k6 summary            |
| GET    | `/api/v1/runs/:id/points`            | Per-second points; filled live while the run is going                                                       |
| POST   | `/api/v1/runs/:id/stop`              | Stop a queued or running run; partial totals and points are kept                                            |
| DELETE | `/api/v1/runs/:id`                   | Delete a finished run and its points                                                                        |
| POST   | `/api/v1/runs/delete`                | Delete up to 50 runs by `ids`; runs in progress are skipped                                                 |

Limits: at most 1000 VUs, 20 stages, 60 minutes per run, 3 runs at a time. A run passes when every limit holds: error rate, p50/p90/p95/p99 latency, and check pass rate above 99%.

## Tests

Backend integration tests (Vitest + Supertest) call every endpoint on the app in-process, against a real Postgres. Each test file makes its own throwaway database and drops it after. Run lifecycle tests start real k6 runs against QuickPizza, so keep the stack up.

```sh
cd backend
pnpm test:db   # starts postgres-test on :10005 (in-memory, compose profile "test")
pnpm test
```

Set `POSTGRES_TEST_PORT` (used by compose and tests) or `TEST_DATABASE_URL` to use another Postgres server. One `postgres-test` per machine: worktrees share it, each test file gets its own database.

Frontend e2e tests (Playwright, Chromium) drive the real UI against a real backend and k6. Playwright starts its own backend (port 10103, fresh `perf_e2e_10103` database on postgres-test) and Vite (port 10104), so the dev stack and its data are never touched. Tests select elements by `data-testid` only, and any console error fails a test. Needs postgres-test and QuickPizza running.

```sh
cd frontend
pnpm exec playwright install chromium   # once
pnpm test:e2e
```

### CI

`.github/workflows/ci.yml` runs on every pull request and on `main`: `pnpm check` and the integration tests for the backend, `pnpm check` and the e2e tests for the frontend. The `ci` job passes only when both pass; mark it as required in branch protection. A failed e2e run uploads the Playwright report as an artifact.
