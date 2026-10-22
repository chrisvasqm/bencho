# Local checks, no CI

Date: 2026-10-22

## Context

The `ci` GitHub Actions workflow ran `pnpm check` and both test suites on every PR, and the `main: require ci` ruleset blocked merges until it passed. Runs were slow, and every new push cancelled the run before it and started again, so merges waited on CI for many minutes.

## Options

1. Keep CI and wait for it before each merge.
2. Remove CI. Run the checks locally before each merge.

## Decision

Option 2 (owner, 2026-10-22). This is temporary.

## Reason

The local checks are the same commands that CI ran and they finish faster. Before a merge, run `pnpm check` in each project you changed, `pnpm test` in `backend/`, and `pnpm test:e2e` in `frontend/`. The PR description lists the checks that ran.

To bring CI back, restore `.github/workflows/ci.yml` from git history and enable the `main: require ci` ruleset again.
