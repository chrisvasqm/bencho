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

Limits: 20 stages, 60 minutes per run, 3 runs at a time. A run passes when error rate, p50/p90/p95/p99 latency and check pass rate (above 99%) all hold.

The Load shape tab shows a rough estimate of how many VUs the Bencho host can run: 80% of its free memory at 5 MB per VU, the high end of k6's guidance for simple tests (`GET /api/v1/capacity`). Long flows, large bodies and other active runs lower the real number. In Docker, free memory is what Docker gives the backend container: the Docker Desktop VM's memory (Settings → Resources) or a `mem_limit`, not the host's.

## Security

Bencho has no accounts: anyone who can open it can start, stop and delete runs, and aim any number of virtual users at any URL. k6 runs on the Bencho host, so a large run can use up its memory and CPU and stop other services on it. Run it on a network you trust, or behind a proxy that authenticates. The local stack binds Postgres and the backend to `127.0.0.1`; only the frontend port is open to other devices.

Set `ALLOW_PRIVATE_TARGETS=false` (exactly; `true` or empty allows, anything else stops startup) to refuse targets on private, loopback and link-local addresses (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `localhost`, `*.internal`, ...), both as literal hosts and after DNS resolution, so Bencho cannot be used to reach services on its own network. They are allowed by default: the demo target is on the compose network. Flow headers whose name contains `auth`, `token`, `key`, `secret`, `cookie`, `session` or `password` are stored for the run but returned as `[redacted]`; request bodies and query strings are returned as sent. URLs cannot carry `user:password@` credentials.

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

Keep QuickPizza running; tests start real k6 runs. Both suites use throwaway databases on `postgres-test` (:10005), so dev data is never touched, and both run in parallel: Vitest gives each test file its own database, Playwright gives each worker its own backend and Vite server (ports 10013/10014, then 10015/10016, ...; `E2E_PORT_BASE` moves them).

```sh
cd backend && pnpm test:db && pnpm test     # integration (Vitest)
cd frontend && pnpm exec playwright install chromium   # once
cd frontend && pnpm test:db && pnpm test:e2e # e2e (Playwright), happy paths only
```

The integration tests cover every endpoint, including validation and errors. The e2e tests cover only what a user does on a good day: the backend enforces every rule the form checks, so the form's own error messages have no e2e test.

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

## License

[MIT](LICENSE)
