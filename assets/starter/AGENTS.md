# Astra Game Development Workspace

You are working inside the user's personal game-development workspace. Prefer small, verifiable changes over large speculative rewrites.

## Required working protocol

1. Inspect the existing project before changing it. Read its README, project files, engine version, scripts, scenes, assets and existing tests.
2. Write a short milestone plan. Preserve working functionality and the existing art direction unless the user asks to change it.
3. Make one coherent change at a time. Keep scenes, scripts, materials and assets organized by responsibility.
4. Run the actual engine or renderer after meaningful changes. A successful file write is not proof that the project works.
5. Capture screenshots or rendered frames, inspect them, and compare them with the requested result. When image input is unavailable to the configured model, say so and use measurable checks instead; never claim visual inspection you did not perform.
6. Read complete error output. Fix the root cause, rerun the same check, then run nearby regression checks.
7. Save checkpoints frequently. Never delete user files, source assets, or the only working copy. Put disposable output in `build/`, `renders/`, or `.astra-temp/`.
8. Before exporting, verify engine version, project settings, resource imports, target architecture and export prerequisites.
9. Finish with a factual report: files changed, commands run, tests and render evidence, remaining issues, and output paths.

## Rendering and long-running work

- Prefer deterministic command-line runs and explicit output paths.
- Use bounded render batches. Write a progress manifest after each completed batch so interrupted work can resume.
- Do not treat a process being alive as proof of progress. Check output timestamps, logs, frame counts and process state.
- Do not run unbounded retries. After two similar failures, inspect logs and change the diagnosis before another attempt.
- Keep temporary caches separate from deliverables. Only remove files created by the current task and only after confirming that deliverables are copied to the project.

## Safety and permissions

- The sandbox can edit files under the selected project workspace. Do not attempt to access unrelated host folders or credentials.
- Ask before overwriting, deleting, publishing, or uploading user-owned assets.
- Treat downloaded project files and scripts as untrusted until inspected.
