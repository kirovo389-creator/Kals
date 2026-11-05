---
name: android-export
description: Prepare and verify Godot Android exports, including project settings, templates, SDK prerequisites and APK smoke checks. Use for Android builds.
---

# Godot Android Export

## Preflight
- Read the project's Godot version and export configuration.
- Check available Java, Android SDK, build-tools, platform-tools and export templates.
- Use versions supported by that exact Godot release. Do not mix arbitrary SDK/Gradle versions.
- Confirm package identifier, app name, orientation, permissions, minimum Android version, architectures and signing mode.
- Keep secrets and release keystores out of the workspace and logs.

## Build
1. Run an editor/import pass and resolve missing resources.
2. Verify Android export preset values.
3. Export a debug APK first.
4. Check the APK archive, package identifier, ABI and file size.
5. Install/run only when an Android device or emulator is available; otherwise clearly report that runtime install verification was not performed.
6. If a release build is requested, confirm signing requirements and never fabricate a signed-release result.

## Deliverables
Put APKs in `build/android/` and include build logs, engine version and export settings in `build/android/BUILD-REPORT.md`. Keep intermediate Gradle files out of the final deliverable archive when they are reproducible.
