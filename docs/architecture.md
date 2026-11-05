# Astra Workstation architecture

## Components

- **Electron shell**: desktop window, startup state, Docker Desktop detection and lifecycle commands.
- **Docker Compose runtime**: launches one pinned Agent Canvas container, maps the localhost-only UI port, persists the OpenHands state directory and mounts the projects folder.
- **OpenHands Agent Canvas**: owns the chat UI, model profiles, conversation history, terminal/file tools, skills discovery and MCP integration.
- **Starter workspace**: `AstraGameDevStarter` contains `AGENTS.md` and project-level skills under `.agents/skills/`.
- **GitHub Actions**: Windows runner executes tests and creates an x64 NSIS setup executable.

## Data flow

1. Astra creates `%APPDATA%/astra-workstation/runtime/compose.yaml` and the Documents project folders.
2. Docker Compose pulls the pinned upstream image if it is not present and starts `astra-agent-canvas` detached.
3. Only `%APPDATA%/astra-workstation/openhands` and `Documents/Astra Workstation/projects` are mounted into the container.
4. Astra waits for the local `/server_info` endpoint, then loads Agent Canvas inside Electron.
5. The user configures Base URL, API key and exact model ID in Agent Canvas's built-in first-run LLM setup. The model key remains in OpenHands' encrypted settings store.
6. The user opens `AstraGameDevStarter`; Agent Canvas discovers the workspace's `.agents/skills` files and supplies relevant skills to the agent.

## Long-running tasks

The container is detached and has `restart: unless-stopped`. Closing Astra leaves it running. Projects, OpenHands settings and conversation data persist on the host. A long task still depends on Windows remaining awake, Docker being healthy, the API being reachable, the provider allowing long requests and the model maintaining sufficient context. Long tasks should checkpoint files, manifests and logs after every stage.

## Current boundary

This release uses a single persistent container for the Agent Canvas server/agent workspace. It does not yet create a fresh isolated container per conversation. The upstream Windows instructions require WSL 2 for the multi-sandbox runtime. GPU passthrough and preinstalled Godot/Blender are not part of this first release.
