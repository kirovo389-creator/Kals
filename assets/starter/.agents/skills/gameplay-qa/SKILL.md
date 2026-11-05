---
name: gameplay-qa
description: Design and execute functional, regression and smoke tests for a playable game. Use when validating gameplay systems, scenes or builds.
---

# Gameplay QA

## Test design
- Derive tests from explicit acceptance criteria and player-visible behavior.
- Include normal paths, boundary values, invalid actions, save/load and scene transitions when relevant.
- Prefer deterministic test scenes and fixed seeds for repeatability.
- Keep tests independent and record the exact engine/build version.

## Execution
1. Confirm the current project imports and launches.
2. Run focused tests for the changed system.
3. Run a smoke path through the core gameplay loop.
4. Inspect engine logs and confirm no unexpected errors or missing resources.
5. Run nearby regression checks after a fix.
6. Re-run the exact failing test before marking a bug fixed.

## Report format
For each test: ID, setup, steps, expected result, actual result, pass/fail, logs or evidence path. Separate verified defects from suspected issues. Never invent a pass based only on static code review.
