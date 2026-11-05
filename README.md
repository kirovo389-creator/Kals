# Astra Workstation 0.3.0

A personal Windows agent workstation built around the official OpenHands Agent Canvas local runtime. Astra provides a desktop launcher, native Windows backend, visible Edge browser automation, persistent user state, workspace shortcuts and game-development skills.

## Features

- Official Agent Canvas 1.35.0 running locally on Windows — no Docker, WSL or separately installed Node.js required.
- Bundled Node.js 24.22.2 and uv 0.13.7, verified by SHA-256 during the Windows build.
- Visible Microsoft Edge controlled through Playwright MCP with a persistent Astra-only browser profile.
- Browser navigation, page inspection, clicking, form filling, screenshots and downloads.
- Browser downloads saved under Documents/Astra Workstation/downloads.
- Default project folder: Documents/Astra Workstation/projects.
- Added folders are exposed under projects/roots as Windows directory junctions.
- Starter Skills for game direction, Godot, Blender, visual QA, gameplay QA, Android export, browser work and native Windows development.
- Windows x64 NSIS installer designed to upgrade Astra 0.2.0 in place.
- Native ingress on 18080, Agent Server on 18100 and Automation on 18101; the backend ports avoid the old 0.2.0 Docker ingress on 18000.

## First launch

1. Install Astra Workstation 0.3.0. Docker Desktop and WSL are not required.
2. Start Astra and select **Запустить Astra**.
3. The first launch starts Agent Canvas and downloads its Python backend packages through the bundled uv runtime. An internet connection is required.
4. Configure an OpenAI-compatible provider in Agent Canvas: exact model ID, Base URL and API key.
5. Open the AstraGameDevStarter project in Agent Canvas to use the included game-development Skills. When upgrading from 0.2.0, the updated native template is placed in AstraGameDevStarter-0.3.0 so the old starter folder is left untouched.

The browser opens in a separate, visible Microsoft Edge window. It uses an Astra-specific profile and remembers its own sign-ins between sessions. Sign in directly in that window; do not paste passwords or one-time codes into chat. You can take control of the browser at any time.

Astra writes an authenticated Playwright MCP server entry to %USERPROFILE%\.openhands\mcp.json. The server endpoint is loopback-only at http://127.0.0.1:18931/mcp.

## Important: native runtime permissions

Astra 0.3.0 uses the OpenHands **without a sandbox** runtime. The agent-server runs directly under the current Windows account and therefore inherits that account's filesystem and process permissions. The list of added folders is a convenience index, **not a security boundary**. The agent may be able to read or modify other files that the account can access.

Do not connect folders containing passwords, API keys, SSH keys, browser profiles or private credentials. Never paste passwords or one-time codes into agent chat. Review commands before approving them and keep backups of important work.

## Upgrade from 0.2.0

The installer retains the existing application ID and product identity. On first launch, Astra copies the old state directory from the 0.2.0 app-data location into %USERPROFILE%\.openhands without deleting the old copy. The browser profile and Documents\Astra Workstation\projects directory remain in place. The old 0.2.0 data folder is retained as a recovery copy. If the previous AstraGameDevStarter project exists, it is preserved and the refreshed 0.3.0 starter is copied beside it as AstraGameDevStarter-0.3.0.

The new runtime uses %USERPROFILE%\.openhands\agent-canvas for Agent Canvas state and %USERPROFILE%\.openhands\mcp.json for MCP configuration. Migration only fills files that do not already exist in the new location; existing destination files are never overwritten.

## Persistence and limitations

Closing Astra does not intentionally stop the detached Agent Canvas or browser processes. Restarting Astra reuses their loopback services. Long-running work still depends on Windows remaining awake, network/API availability, provider limits and model context.

This is a comparable local agent workstation, not a literal copy of Notion's proprietary implementation. Native Windows mode does not provide container isolation. Godot and Blender are not bundled and must be installed separately when a project needs them.

## Development

Requires Node.js 24+ and npm:

```powershell
npm install
npm test
npm run download:runtimes
npm start
npm run build
```

The Windows installer is emitted under dist/.

## Upstream

- OpenHands Agent Canvas: https://github.com/OpenHands/OpenHands
- Microsoft Playwright MCP: https://github.com/microsoft/playwright-mcp
- uv: https://github.com/astral-sh/uv
- Node.js: https://nodejs.org/
- Third-party notices: THIRD-PARTY-LICENSES.md

Astra is an independent integration and is not an official OpenHands or Notion product.
