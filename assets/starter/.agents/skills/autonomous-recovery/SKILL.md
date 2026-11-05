---
name: autonomous-recovery
description: Run long game-development tasks with checkpoints, progress manifests, bounded retries and recovery after interruptions. Use for multi-stage or long-running work.
---

# Autonomous Execution and Recovery

## Plan for resumability
- Split the assignment into independently verifiable stages with explicit inputs and outputs.
- Store the plan and current stage in `docs/WORK-PLAN.md` and progress in `docs/PROGRESS.md`.
- Before any expensive operation, write a checkpoint and record the exact command, working directory and output path.
- Keep generated temporary files separate from source assets.

## Progress control
- Set a time or iteration budget for each stage. Report the budget and completed work honestly.
- For renders/builds, track process ID, last log timestamp, output count, and expected output count.
- Detect stalled jobs from unchanged logs/output, not merely from elapsed time.
- Use bounded retries. After two similar failures, stop and re-evaluate the cause.
- Preserve partial render batches and resume only missing or invalid outputs.

## Recovery
1. Read the latest plan, progress file and logs.
2. Verify that referenced files and processes still exist.
3. Re-run only incomplete or failed stages.
4. Never overwrite a valid previous deliverable without a backup.
5. Update the progress file after every completed milestone.

## Completion
A stage is complete only when its acceptance tests pass and its outputs are verified. The final report must list completed stages, tests, screenshots/renders, output paths, remaining defects and any checks blocked by unavailable tools or model capabilities.
