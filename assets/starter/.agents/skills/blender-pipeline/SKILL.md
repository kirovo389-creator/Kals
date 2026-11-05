---
name: blender-pipeline
description: Create and refine Blender models, UVs, materials, rigs, animation and game-ready exports. Use for Blender asset production.
---

# Blender Asset Pipeline

## First inspect
- Check `blender --version`; do not change the project's intended Blender version without a reason.
- Inspect source `.blend` files and linked assets before modifying them.
- Identify the target engine, scale convention, polygon budget, texture budget, animation needs and export format.
- Keep source scenes separate from exported game assets.

## Modeling workflow
1. Write a compact asset brief: purpose, silhouette, dimensions, references, required states and target platform.
2. Block out proportions before adding detail. Validate silhouette at intended gameplay distance.
3. Apply or preserve transforms deliberately; check normals, non-manifold geometry and object origins.
4. Create UVs with suitable texel density. Avoid accidental overlaps unless the texture workflow requires them.
5. Use PBR materials with documented base color, roughness, metallic and normal inputs. Pack or copy dependencies into the project.
6. Add a rig only when deformation is needed. Name bones and actions clearly; test deformations at extreme poses.
7. Keep animation actions named and verify timing, root motion and looping.
8. Export a copy to GLB/FBX with explicit axis, scale, animation and material settings.

## Automation
- Prefer Blender background mode with a reviewed Python script and explicit output paths.
- Save a versioned `.blend` before destructive operations.
- Capture a preview render before a long final render.
- Use deterministic frame ranges, resolution, samples and output format.
- Record Blender version, render engine, device and elapsed time in `renders/manifest.json`.

## Game-ready review
Check silhouette, scale, topology, normals, UVs, material slots, texture paths, rig hierarchy, animation playback, export re-import and triangle/texture budgets. Test the exported asset in the target engine; a correct Blender viewport is not proof of correct game import.
