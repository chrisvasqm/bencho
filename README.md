# API performance testing (k6)

Requires [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) (`brew install k6`), Node 24, pnpm, Docker.

```sh
pnpm install
cp example.env .env     # optional: change target, load shape, limits
pnpm start              # start local QuickPizza on http://localhost:3333
```

Stop it with `pnpm stop`.

| Test   | What it does                            | Run           |
| ------ | --------------------------------------- | ------------- |
| Load   | Steady expected traffic (10 VUs, 2 min) | `pnpm load`   |
| Stress | Steps up to 50 VUs to find the limit    | `pnpm stress` |
| Spike  | Jumps 5 → 100 VUs, then recovers        | `pnpm spike`  |

Each test command builds first (`pnpm build`), then runs `dist/<test>.js` with k6.

## Configuration

All settings are env vars, from `.env` or inline (`STAGES=10s:5 pnpm load`). See `example.env`.

| Variable             | Default                 | Meaning                                                                   |
| -------------------- | ----------------------- | ------------------------------------------------------------------------- |
| `BASE_URL`           | `http://localhost:3333` | Target URL                                                                |
| `STAGES`             | per test                | Load shape, `<duration>:<VUs>` comma-separated, e.g. `30s:10,1m:10,30s:0` |
| `THINK_TIME_SECONDS` | `1`                     | Wait between requests per virtual user                                    |
| `MAX_ERROR_RATE`     | `0.01`                  | Fail when failed requests reach this fraction (1%)                        |
| `P50_MS`             | `200`                   | p50 latency limit                                                         |
| `P90_MS`             | `400`                   | p90 latency limit                                                         |
| `P95_MS`             | `500`                   | p95 latency limit                                                         |
| `P99_MS`             | `1000`                  | p99 latency limit                                                         |
| `QUICKPIZZA_PORT`    | `3333`                  | Host port for the local container; keep `BASE_URL` in sync                |

A crossed limit (or a check pass rate under 99%) makes the run exit non-zero (k6 exit code 99).

## Layout

- `scripts/build.ts`: esbuild bundles each `tests/*.ts` with its `lib/` imports into `dist/`.
- `scripts/run.ts`: Node entry point run by `tsx`. Loads `.env` (dotenv), then starts `k6 run dist/<test>.js`. k6 has its own JS runtime (not Node), so dotenv can't run inside tests.
- `tests/*.ts`: one file per test type; only sets the default load shape.
- `lib/config.ts`: reads and validates every env var.
- `lib/options.ts`: builds k6 options: stages + shared thresholds.
- `lib/scenario.ts`: what each virtual user does.

`pnpm check` runs typecheck + ESLint + Prettier check + build. `pnpm format` fixes formatting.
