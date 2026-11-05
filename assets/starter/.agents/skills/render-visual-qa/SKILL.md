---
name: render-visual-qa
description: Run Godot or Blender renders, collect screenshots and logs, inspect visual evidence and manage render iterations. Use when a task requires visual output or quality review.
---

# Render and Visual QA

## Before rendering
- Identify the actual executable, project/scene, render engine, output directory and required resolution.
- Check available RAM, VRAM, CPU/GPU devices, disk space and whether a display server is available.
- Use CPU rendering as the portable fallback. Only request GPU rendering when the container can see a supported device and the renderer confirms it.
- Make a low-cost preview first; do not start a multi-hour final render with unverified settings.

## Render stages
1. Validate source files and dependencies.
2. Run a short preview render or a low-resolution frame.
3. Inspect the preview for framing, missing geometry, material errors, lighting, shadows, clipping, color and composition.
4. Fix the scene/script, save a checkpoint and render the preview again.
5. Start the final render in bounded batches. Record each completed frame or output file in a manifest so interrupted work can resume.
6. Verify output files exist, are non-empty, decode correctly and match the expected dimensions/frame count.

## Visual inspection honesty
- If the model can receive images, attach or open the actual screenshot/render and review it.
- If image input is unsupported, do not claim that the image was visually inspected. Perform technical checks and report the limitation.
- Compare against the user's stated requirements, not a vague claim of photorealism.

## Evidence
Save screenshots, render settings, logs and a short QA report under `renders/` or `reports/`. Keep source files untouched and never delete user-provided references.
