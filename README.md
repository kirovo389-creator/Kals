# Astra Workstation

A personal Windows desktop launcher for a local, persistent OpenHands Agent Canvas instance. The upstream Agent Canvas supplies the chat, conversation history, terminal, file browser, model configuration, skills and MCP interfaces. Astra adds a small Electron desktop shell, a Docker Compose runtime and a game-development starter workspace.

## What it does

- Starts the pinned `ghcr.io/openhands/agent-canvas:1.35.0` image through Docker Desktop.
- Binds the web service to `127.0.0.1:18000` only.
- Persists Agent Canvas settings, credentials, conversations and server state in the user's Astra application-data folder.
- Mounts only `Documents/Astra Workstation/projects` as `/projects`; it does not mount the whole Windows drive.
- Uses `restart: unless-stopped`, so closing Astra does not stop an active container. The container can also start again after a Windows/Docker restart.
- Seeds `AstraGameDevStarter` with project-level Agent Skills for game design, Godot, Blender, rendering/visual QA, gameplay QA, Android export and long-task recovery.
- Builds a Windows x64 NSIS installer (`.exe`) on GitHub Actions.

## First launch

1. Install and start [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/). WSL 2 backend is recommended.
2. Install Astra Workstation and launch it.
3. Select **Запустить песочницу**. First startup pulls the Agent Canvas image and may take several minutes.
4. Agent Canvas opens its own first-time setup. Select the OpenHands agent, then configure an OpenAI-compatible provider under the LLM setup's Advanced option: exact model ID, Base URL and API key. These credentials are stored by Agent Canvas, not by the Astra launcher.
5. Open the workspace folder `Documents\Astra Workstation\projects\AstraGameDevStarter` in Agent Canvas. Its `.agents/skills` directory contains the game-development skills.
6. Start a conversation and ask for a bounded first milestone. For long renders, ask the agent to maintain checkpoints and a progress manifest.

For an OpenAI-compatible API, the endpoint must be reachable from inside Docker. If the API server runs on the Windows host, use `host.docker.internal` rather than `127.0.0.1` in the Base URL. For remote API providers, use the provider's normal HTTPS Base URL.

## Persistence and cleanup

Closing the Astra window intentionally does not run `docker compose down`. This allows a running task to continue while Windows and Docker remain awake. Windows sleep, shutdown, Docker shutdown, network loss, API outages, provider limits or context limits can pause/fail a task; persistent files and conversation state make recovery possible but do not guarantee uninterrupted work for dozens of hours.

To stop the background container manually:

```powershell
docker stop astra-agent-canvas
```

To start it again, open Astra and select **Запустить песочницу**. To remove only the container (not the persisted data), use:

```powershell
docker rm -f astra-agent-canvas
```

Do not delete `%APPDATA%\astra-workstation\openhands` or the projects folder unless you intend to remove the saved state/projects.

## Sandbox boundary

The agent runs inside a Linux container. It can read and modify the mounted Astra projects folder and its own persistent OpenHands state. It does not receive a mount of the full Windows filesystem. The container still has outbound network access, and files in the mounted project folder are intentionally writable. Treat downloaded scripts and dependencies as untrusted and review destructive commands.

This initial Windows package runs one persistent Agent Canvas container. It is not yet the separate disposable Docker container per conversation mode; OpenHands documents that multi-sandbox mode on Windows requires running Agent Canvas inside a Linux distribution under WSL 2 with Docker integration.

## Godot, Blender and GPU note

The starter skills teach the agent how to inspect, install/use and verify Godot and Blender in the Linux workspace. The base Agent Canvas image does not bundle full Godot and Blender installations, so the agent may need to download/install the required versions for a project. GPU rendering is not promised by this first package: the container uses CPU rendering unless a supported GPU is explicitly exposed and confirmed by the renderer. On the previously described Ryzen 3 3250U / 8 GB / integrated Radeon computer, expect CPU-only 3D renders and limited capacity for large projects. Heavy Blender scenes and long high-sample renders may be impractical without a stronger PC and supported GPU setup.

The configured model must support reliable tool use for agentic execution. For image-based review, it must also accept image inputs. If it cannot process images, the skills require the agent to report that limitation and use technical checks instead of pretending to inspect renders.

## Development

Requires Node.js 22+ and npm:

```powershell
npm install
npm test
npm start
npm run build
```

The Windows installer is emitted under `dist/`.

## Upstream and license

Astra uses the MIT-licensed [OpenHands Agent Canvas](https://github.com/OpenHands/OpenHands) Docker image. See `THIRD-PARTY-LICENSES.md` and the upstream license notice. This project is a launcher/integration, not an official OpenHands product and not a copy of Notion's proprietary implementation.
