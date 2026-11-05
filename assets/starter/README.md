# Astra GameDev Starter

This workspace contains Astra's game-development instructions. Open this folder as the workspace in Agent Canvas to activate the skills under `.agents/skills/`.

## Included skills

- `game-director`: game concept, GDD, scope, milestones and design consistency.
- `godot-engineering`: Godot project inspection, GDScript, scenes, gameplay, profiling and exports.
- `blender-pipeline`: Blender modeling, UVs, materials, rigging, animation and asset export.
- `render-visual-qa`: render orchestration, screenshot evidence and visual review.
- `gameplay-qa`: repeatable functional tests and regression checks.
- `android-export`: Android export readiness and APK verification.
- `autonomous-recovery`: resumable long-running jobs, checkpoints and failure recovery.

Engines are not bundled in this starter project. The agent must inspect the sandbox OS and available disk/memory first, then install or download compatible official tools only when needed. On Windows, the actual development tools run inside the Linux Docker environment, not directly on the Windows host.
