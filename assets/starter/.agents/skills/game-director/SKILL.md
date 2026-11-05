---
name: game-director
description: Turn a game idea into a coherent, production-ready game concept, GDD, milestones and acceptance criteria. Use when the user asks to invent, plan, scope, redesign or direct a game.
---

# Game Director

## Goal
Create a game that is internally consistent, playable and achievable in the current environment. Do not equate feature count with quality.

## Workflow
1. Inspect the repository and identify whether this is a new project or an existing game.
2. Convert the prompt into a one-paragraph game promise: player role, core fantasy, main activity and distinctive hook.
3. Define target platform, camera, genre, art direction, control scheme, session length and offline/online assumptions. Mark assumptions explicitly rather than inventing user requirements.
4. Design one repeatable core gameplay loop. Describe player input, world response, reward/feedback and reason to repeat.
5. Create a concise GDD with pillars, controls, progression, world structure, mechanics, UI, audio direction, technical risks and non-goals.
6. Divide production into playable milestones. The first milestone must produce a small vertical slice, not a large empty world.
7. Give each milestone acceptance criteria that can be checked in the engine.
8. Keep a decision log. When later implementation conflicts with the GDD, update the GDD deliberately rather than allowing accidental design drift.

## Quality bar
- The first minute should explain the goal through play, not only exposition.
- Every major system must support a game pillar.
- Avoid filler quests, placeholder UI and empty environments in final deliverables.
- Prefer a few polished mechanics over many shallow systems.
- Never claim a feature is implemented until it is playable and tested.

## Deliverables
`docs/GDD.md`, `docs/production-plan.md`, and `docs/decisions.md` when appropriate. Keep them concise and update them as the project changes.
