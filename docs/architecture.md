# Astra Workstation architecture

## Overview

Astra is a Windows desktop shell around OpenHands Agent Canvas. The agent backend runs in Docker; the browser automation runtime runs on Windows so the user can see and take over the browser.

## Components

- **Electron shell**: startup, Docker lifecycle, folder picker and local process management.
- **OpenHands Agent Canvas**: conversations, model profiles, skills, MCP settings, files, terminals, and agent tasks.
- **Docker Compose runtime**: one persistent Agent Canvas container with a localhost-only web UI and persistent state.
- **Workspace mounts**: the default Astra projects folder plus every additional folder explicitly selected by the user. Additional roots appear under /projects/roots/<folder-id>.
- **Playwright MCP**: pinned Microsoft Playwright MCP 0.0.84, running on Windows with a visible Microsoft Edge window and a persistent Astra-only browser profile.
- **Authenticated gateway**: a random bearer token protects the browser MCP HTTP endpoint exposed to Docker. The upstream Playwright MCP server binds only to Windows loopback; the gateway forwards authenticated requests to it.
- **Starter skills**: game director, Godot engineering, Blender pipeline, visual QA, gameplay QA, Android export, autonomous recovery and browser automation.

## Browser data flow

1. Astra creates a dedicated browser profile under its application-data folder.
2. Astra starts Playwright MCP in headed Edge mode on Windows. It does not reuse the user's everyday Edge profile.
3. A local proxy checks a randomly generated bearer token before forwarding MCP traffic.
4. Docker receives a host.docker.internal host mapping and the OpenHands state directory contains an MCP server entry pointing to the authenticated gateway.
5. The agent uses structured page snapshots, element references, clicks, form filling, screenshots, downloads and other Playwright browser tools.
6. The Edge window remains visible so the user can inspect actions, sign in manually or take control.

Browser login state persists in the Astra-specific profile. Passwords and one-time codes should be entered directly by the user in the visible browser, not pasted into chat. The agent must obtain confirmation before final actions that send, publish, book, purchase or change an account.

Browser downloads are saved under Documents/Astra Workstation/downloads.

## File access model

- /projects maps to Documents/Astra Workstation/projects.
- The user can add more folders through the Astra launcher. Each selected folder is mounted read/write under /projects/roots/<folder-id>.
- Astra rejects drive roots, Windows/Program Files/ProgramData, application-data roots and common credential directories.
- The agent can create, edit, move and delete files inside connected roots. It cannot access arbitrary host paths that have not been mounted.
- Do not connect folders that contain secrets, browser profiles, SSH keys, or API credentials.

This is deliberately broad access to user-selected working folders, not unrestricted access to the Windows operating system or credential stores.

## Long-running tasks

The container is detached and has restart: unless-stopped. Closing Astra does not stop the agent container. Projects, OpenHands settings and conversations persist on the host. Long tasks still depend on Windows remaining awake, Docker health, network/API availability, provider limits and model context. Use checkpoints, progress manifests and bounded retries.

## Current limitations

- This is a comparable local agent workstation, not a literal copy of Notion's proprietary implementation.
- The first release uses one persistent Agent Canvas container, not a separate disposable container for each conversation.
- Browser automation depends on Microsoft Edge being installed and on the MCP configuration being loaded by the active Agent Canvas backend.
- GPU passthrough and preinstalled Godot/Blender are not part of this release. The configured model must support tool use; image-based visual QA also requires image input support.
