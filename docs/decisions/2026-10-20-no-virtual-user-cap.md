# No cap on virtual users per stage

Date: 2026-10-20

## Context

Stages were limited to 1000 virtual users. Bencho runs k6 on the host that serves it, so the cap also protected that host from overload. Removing it widens OWASP API4 (unrestricted resource consumption) for anyone who can open Bencho.

## Options

1. Keep a fixed cap (1000 or higher).
2. Optional `MAX_VIRTUAL_USERS` env setting, no cap when unset.
3. No product cap; reject only targets that are not safe integers.

## Decision

Option 3 (owner, 2026-10-20).

## Reason

The person who runs Bencho decides how many virtual users their machine can handle and accepts the risk of overloading it. Bencho is meant for a trusted network; the README's Security section says so.
