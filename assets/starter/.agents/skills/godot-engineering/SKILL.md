---
name: godot-engineering
description: Build, debug, optimize and verify Godot projects using scenes, nodes, resources, GDScript and command-line runs. Use for Godot tasks.
---

# Godot Engineering

## First inspect
1. Read `project.godot` and identify the exact Godot major/minor version and renderer.
2. Inspect `scenes/`, `scripts/`, `assets/`, autoloads, input actions and existing project conventions.
3. Check whether `godot` or `godot4` exists. Record its version. If absent, choose an official Godot build compatible with the project and sandbox architecture; do not silently upgrade an existing project.
4. Import resources before testing when required by the engine version.

## Architecture
- Prefer composition with focused scenes and scripts over one monolithic controller.
- Use typed GDScript where it improves clarity; avoid speculative abstractions.
- Keep reusable resources in `resources/`, scenes in `scenes/`, scripts in `scripts/`, and project docs in `docs/`.
- Use signals for decoupled events. Avoid hard-coded node paths when exported references or groups are more robust.
- Keep input actions in Project Settings and test keyboard, mouse and controller paths when relevant.
- Keep gameplay state separate from UI presentation.

## Implementation loop
1. Define the smallest playable slice and its observable acceptance criteria.
2. Implement one system.
3. Run a headless editor/import pass, then a real project run where possible.
4. Inspect stdout/stderr and engine errors. Treat missing resources, parse warnings and invalid node paths as defects.
5. Capture a frame or use a test scene to verify the actual output.
6. Run relevant regression tests after fixing defects.

## 3D-specific checks
- Verify units, scale, transforms, collision shapes, camera clipping and light ranges.
- Check normal direction, material transparency, mipmaps and texture import settings.
- Confirm that the chosen renderer is supported by the target device.
- Profile frame time and memory in representative scenes; do not report FPS from an empty test scene as final performance.

## Do not
- Rewrite the project structure without need.
- Replace missing assets with arbitrary primitives and call the result finished.
- suppress engine errors to make a run appear clean.
- claim visual inspection if no image was actually reviewed.
