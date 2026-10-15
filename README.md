# API performance testing (k6)

Requires [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) (`brew install k6`), Node 24, pnpm.

```sh
pnpm install
cp example.env .env     # optional: set BASE_URL
pnpm start            # start local QuickPizza on http://localhost:3333
```

Stop it with `pnpm stop`.

| Test   | What it does                            | Run           |
| ------ | --------------------------------------- | ------------- |
| Load   | Steady expected traffic (10 VUs, 2 min) | `pnpm load`   |
| Stress | Steps up to 50 VUs to find the limit    | `pnpm stress` |
| Spike  | Jumps 5 → 100 VUs, then recovers        | `pnpm spike`  |

`BASE_URL` defaults to `http://localhost:3333` (local QuickPizza from `compose.yaml`). Set it in `.env` or inline: `BASE_URL=http://localhost:3000 pnpm load`.

## Layout

- `scripts/run.ts`: Node entry point run by `tsx`. Loads `.env` (dotenv), then starts `k6 run`. k6 has its own JS runtime (not Node), so dotenv can't run inside tests.
- `tests/*.ts`: one file per test type; only sets load shape (stages) and limits. k6 runs TS natively.
- `lib/scenario.ts`: what each virtual user does.
- `lib/thresholds.ts`: shared pass/fail limits (error rate, p95 latency, checks > 99%). A crossed limit makes the run exit non-zero.

`pnpm check` runs typecheck + ESLint + Prettier check. `pnpm format` fixes formatting.
