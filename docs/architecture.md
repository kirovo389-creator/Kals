# Astra Workstation architecture (0.3.0)

## Overview

Astra is a Windows desktop shell around the official OpenHands Agent Canvas local, no-sandbox runtime. The backend runs directly on the host account; Docker and WSL are not used. Browser automation runs in a separate visible Microsoft Edge process.

## Components

- **Electron shell**: startup, user-data migration, folder picker, process launch, diagnostics and local service lifecycle.
- **OpenHands Agent Canvas 1.35.0**: local UI, conversations, model profiles, agent server and automation backend.
- **Bundled Node.js 24.22.1**: provides node/npm/npx for MCP servers and local tools.
- **Bundled uv 0.13.7**: resolves pinned OpenHands Python packages and a compatible Python runtime.
- **Playwright MCP**: Microsoft Playwright MCP 0.0.84, running on Windows with visible Edge and a persistent Astra-only profile.
- **Authenticated browser gateway**: a random bearer token protects the browser MCP HTTP endpoint. The upstream Playwright server and gateway bind only to Windows loopback.
- **Workspace junctions**: the default Documents/Astra Workstation/projects directory is linked to the conventional %USERPROFILE%\workspace path if that path does not already exist. User-added folders are exposed under projects/roots/<folder-id>.
- **Starter skills**: game director, Godot engineering, Blender pipeline, visual QA, gameplay QA, Android export, autonomous recovery, browser automation and native Windows development.

## Runtime startup

1. Astra checks the bundled Node.js and uv executables and validates their versions.
2. Astra prepares %USERPROFILE%\.openhands and migrates missing files from the 0.2.0 app-data state directory without deleting the old copy.
3. The Agent Canvas state directory is passed through OH_CANVAS_SAFE_STATE_DIR. The API key and secret key persist between restarts.
4. Astra starts Playwright MCP and the authenticated gateway on loopback, then writes the browser entry to %USERPROFILE%\.openhands\mcp.json.
5. Astra launches the official Agent Canvas CLI using bundled Node.js, with bundled node/npm/npx and uv added to PATH.
6. The UI is available at http://127.0.0.1:18080. Agent Server and Automation use their upstream default internal ports.

The first native launch may download Python packages through uv. Agent Canvas startup has a 15-minute readiness window and its log is written to the Astra app-data logs folder.

## Browser data flow

1. Astra creates a dedicated browser profile under the Astra app-data directory.
2. Astra starts Playwright MCP in headed Edge mode. It does not reuse the user's everyday Edge profile.
3. A local proxy checks a randomly generated bearer token before forwarding MCP traffic.
4. Agent Canvas receives an MCP server entry at http://127.0.0.1:18931/mcp.
5. The agent uses structured page snapshots, element references, clicks, form filling, screenshots, downloads and other Playwright browser tools.
6. The Edge window remains visible so the user can inspect actions, sign in manually or take control.

Browser logins persist in the Astra-specific profile. Passwords and one-time codes should be entered directly by the user in the visible browser, not pasted into chat. The agent must obtain confirmation before final actions that send, publish, book, purchase or change an account.

Browser downloads are saved under Documents/Astra Workstation/downloads.

## File access and security

- The native Agent Server runs under the current Windows user account.
- It inherits that account's filesystem and process permissions; this is not a filesystem sandbox.
- The added-folder list is a convenience index, not an access-control boundary.
- Astra rejects drive roots, Windows/Program Files/ProgramData, application-data roots and common credential directories when the user adds a folder.
- The agent can still access other paths available to the Windows account. The user should not put secrets in prompts or connected workspaces and should keep backups.

This mode trades container isolation for a simpler native installation without Docker or WSL.

## Long-running tasks

The Agent Canvas and browser processes are detached so they can outlive the launcher window. Restarting Astra reuses the loopback services. Long tasks still depend on Windows remaining awake, network/API availability, provider limits and model context.

## Current limitations

- This is a comparable local agent workstation, not a literal copy of Notion's proprietary implementation.
- Agent Canvas runs in its upstream no-sandbox mode: per-conversation container isolation is not available.
- GPU passthrough and preinstalled Godot/Blender are not part of this release.
- Browser automation depends on Microsoft Edge being installed and on the MCP configuration being loaded by Agent Canvas.
- The configured model must support tool use; image-based visual QA also requires image input support.
