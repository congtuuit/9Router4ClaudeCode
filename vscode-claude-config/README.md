# 9Router4ClaudeCode

Switch Claude Code between Anthropic and a custom endpoint such as **9Router**
(`http://localhost:20128`), pick models fetched from the API, and tweak
`settings.json` from the VS Code Settings screen. Your original Claude Code
settings are snapshotted and can always be restored.

## Quick start

1. Run **Claude Config: Switch Profile** (`Ctrl+Shift+P`) and pick `9Router`.
2. Run **Claude Config: Set API Key** if your router needs a key other than the default.
3. Run **Claude Config: Select Model (from API)** to choose a model.
4. Restart your Claude Code session.

The status bar shows `Claude: <profile>` when the custom config is on and
`Claude: default` when it is off.

## Commands

| Command | What it does |
|---|---|
| Switch Profile | Apply a profile (endpoint, key, model, permissions). |
| Enable Custom Config | Re-apply the active profile. |
| **Disable & Restore Original** | Restore your original Claude Code settings. |
| Set API Key | Store a key in the OS keychain (per profile, or one override for all). |
| Add / Delete Profile | Manage saved profiles. |
| Select Model (from API) | Pick from the model list fetched from `/v1/models`. |
| Test Connection | Probe the endpoint and log the models found. |
| Open Settings Screen | Edit overrides in the VS Code Settings UI. |
| Open settings.json | Open the live Claude Code settings file. |
| Restore Latest Backup | Restore the most recent timestamped backup. |

## Settings screen (`claudeConfig.*`)

Everything under `claudeConfig.override.*` is merged on top of the active profile
and written to Claude Code's `settings.json` automatically (`claudeConfig.autoApply`).
Leave a value empty to use the profile's value. `extraEnv` and `extraSettings`
accept any extra `env` entries or top-level keys (`hooks`, `mcpServers`, ...).

Precedence: **profile < model picked from API < Settings screen**.

## How files are managed

In `~/.claude/` (or `<workspace>/.claude/` with `claudeConfig.scope = workspace`):

| File | Role |
|---|---|
| `settings.claude.json` | Snapshot of your original settings (taken once on first enable). |
| `settings.9router.json` | This extension's overlay. |
| `settings.json` | What Claude Code reads: snapshot + overlay. |

Changes you make to `settings.json` by hand while the extension is active are
kept when you restore.

## Going back to the default Claude account

1. Run **Claude Config: Disable & Restore Original**.
2. Restart Claude Code sessions.

> **Important:** disabling the extension in the Extensions view does *not* restore
> anything, because VS Code has no "disabled" event. Run the command above first.
> Uninstalling restores your settings automatically the next time VS Code restarts.
> If `ANTHROPIC_BASE_URL` is also set in your OS environment, it still applies.

Optional: set `claudeConfig.restoreOnDeactivate` to restore on every deactivation
(this also triggers on window reload/close, so it is off by default).

## Security

- API keys are stored in VS Code **SecretStorage** (OS keychain), not in profiles or VS Code settings.
  Keys left in plain text by earlier versions are migrated automatically.
- Claude Code itself reads the key from `settings.json`, so it is written there
  (and into `settings.9router.json`) in your home directory. Treat those files as secrets
  and do not commit `.claude/` folders from workspaces.
- The default `9Router` profile uses `bypassPermissions` and `allow: ["*"]`,
  which lets Claude Code run commands without asking. Change `permissionMode` to
  `default` on shared or sensitive machines.

## Build and install

```powershell
npm install
npm run build
npx @vscode/vsce package
code --install-extension 9router4claudecode-0.1.0.vsix
```

For development, open the folder and press **F5**.
