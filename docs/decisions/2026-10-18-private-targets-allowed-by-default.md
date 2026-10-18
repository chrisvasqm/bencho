# Private targets are allowed by default

Date: 2026-10-18

## Context

The OWASP review (PR #15) added a block on private, loopback and link-local targets, so a reachable Bencho cannot be aimed at services on its own network. It shipped off by default in production, following the general rule that every feature flag defaults off there.

## Options

1. Blocked by default in production; `ALLOW_PRIVATE_TARGETS=true` allows.
2. Allowed everywhere; `ALLOW_PRIVATE_TARGETS=false` blocks.

## Decision

Option 2 (owner, 2026-10-18).

## Reason

Bencho has no accounts and is meant for a trusted network, where the systems under test usually are private addresses. A default that refuses them makes the first run fail on most deployments. Operators who expose Bencho further set the flag to `false`; the README's Security section says so.
