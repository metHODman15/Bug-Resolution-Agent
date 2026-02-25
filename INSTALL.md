# Installation Instructions

Step-by-step guide for installing and configuring the Salesforce Debug Agent extension.

---

## Prerequisites

### Required

✅ **VS Code** 1.90.0 or higher
- Download: https://code.visualstudio.com/
- Check your version: **Help → About**

✅ **GitHub Copilot Chat** extension
- Install from the VS Code Marketplace: search **GitHub Copilot Chat**
- This provides the Chat panel that `@sfdebug` lives inside — the same requirement as Claude Code or any other chat participant

✅ **Anthropic API Key**
- Get one: https://console.anthropic.com/
- Format: `sk-ant-...`

### Recommended

✅ **Salesforce CLI** — needed to run investigation queries
- Install: `npm install -g @salesforce/cli`
- Verify: `sf --version`

✅ **Authenticated Salesforce Org** — sandbox recommended
- Authenticate: `sf org login web -a myOrg`

> **No Python required.** The extension calls the Anthropic API directly — there is no local backend to install or manage.

---

## Building the .vsix (from source)

Use this when you have the source code and want to produce an installable `.vsix` file.

**Prerequisites**: Node.js v16+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Build and package
npm run package:vsix
```

This produces **`extension.vsix`** in the project root.

> Tip: if `vsce` is not installed globally, the script uses `npx vsce` automatically.

---

## Installation Methods

### Method 1: From Source (Development / F5)

```bash
git clone <repository-url>
cd WorkSpace
npm install
npm run compile
code .
```

Press **F5** (Run → Start Debugging) to open a new Extension Development Host window with the extension active.

### Method 2: From Package (.vsix)

**Via VS Code UI**:
1. View → Extensions → **⋯** → Install from VSIX…
2. Select `extension.vsix`
3. Reload VS Code when prompted

**Via command line**:
```bash
code --install-extension extension.vsix
```

### Method 3: From Marketplace (when published)

1. View → Extensions → search **Salesforce Debug Agent** → Install

---

## Post-Installation Setup

### Step 1: Configure your Anthropic API Key

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run: **SF Debug: Configure Anthropic API Key**
3. Enter your key (`sk-ant-...`)

The key is stored securely in VS Code's secret storage (macOS Keychain / Windows Credential Manager / Linux Secret Service). It is never written to disk.

### Step 2: Verify Salesforce CLI

```bash
sf --version          # check it's installed
sf org list           # see authenticated orgs
sf org login web -a myOrg   # authenticate if needed
```

### Step 3: Run a test investigation

1. Open the Chat panel — click the chat icon in the Activity Bar, or press `Cmd+Ctrl+I` (macOS) / `Ctrl+Alt+I` (Windows/Linux)
2. Type `@` in the chat input — `@sfdebug` should appear in the participant list
3. Select it and type your issue, for example:
   ```
   @sfdebug org:myOrg symptom:users can't see records object:Opportunity records:006Xx000001234,006Xx000001235
   ```
4. The agent streams a plan — if it appears, everything is working ✓
5. Type `yes` or click **Approve & Run** to execute the investigation

---

## Verification Checklist

- [ ] Extension visible in Extensions panel
- [ ] **SF Debug: Configure Anthropic API Key** appears in Command Palette
- [ ] API key saves without error
- [ ] `@sfdebug` appears when typing `@` in the Chat panel
- [ ] Investigation plan streams when describing a Salesforce issue
- [ ] Typing `yes` or `/approve` runs the plan
- [ ] Reports appear in `runtime/Reports/` after `/report`

---

## Configuration

Access via **File → Preferences → Settings → "SF Debug"**:

| Setting | Default | Description |
|---|---|---|
| `sfDebug.defaultOrgAlias` | `""` | Pre-fill the org alias input |
| `sfDebug.maxRetryAttempts` | `2` | Max retries before loop-breaker |
| `sfDebug.enableWebSearch` | `true` | Web search on loop-breaker trigger |

---

## Troubleshooting

### `@sfdebug` not appearing in Chat
1. **GitHub Copilot Chat must be installed** — it provides the Chat panel. Install it from the Marketplace, then reload VS Code.
2. **Uninstall the old VSIX first** — VS Code won't replace a stale install cleanly. Extensions panel → gear icon → Uninstall → reload → re-install the new `.vsix`.
3. **VS Code version** — Chat participants require 1.90+. Check **Help → About**.
4. If you see a red error popup on startup like "failed to register chat participant", it means step 1 above was missed.

### Extension not appearing in Extensions panel
- Check VS Code version (need 1.90.0+): **Help → About**
- Try **Developer: Reload Window**

### API key fails to save
- **macOS**: Ensure Keychain Access is unlocked
- **Windows**: Check Credential Manager is accessible
- **Linux**: Install `gnome-keyring` (`sudo apt install gnome-keyring`) or KWallet

### `sf: command not found`
```bash
npm install -g @salesforce/cli
# Restart terminal and VS Code after installing
```

### `npm run compile` fails
```bash
rm -rf node_modules package-lock.json
npm install
npm run compile
```
Requires Node.js v16+. Check with `node --version`.

---

## Uninstallation

**From VS Code**: Extensions panel → gear icon on Salesforce Debug Agent → Uninstall

**Remove runtime data**:
```bash
rm -rf runtime/
```

The API key is removed automatically when the extension is uninstalled.

---

## Network Requirements

The extension makes outbound HTTPS calls to:

- `https://api.anthropic.com` — AI plan generation and analysis
- Your Salesforce org — CLI queries
- `https://login.salesforce.com` — Salesforce auth

If you are behind a corporate proxy:
```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
sf config set https-proxy http://proxy.company.com:8080
```

---

**Installation Complete! 🎉**

Open the Chat panel (`Cmd+Ctrl+I`), type `@sfdebug`, and describe your Salesforce issue.

**Available slash commands:**

| Command | What it does |
|---|---|
| `@sfdebug /investigate` | Start a new investigation (or just describe the issue naturally) |
| `@sfdebug /approve` | Approve the generated plan and run it |
| `@sfdebug /report` | Generate the full report bundle (BU, Tech, Client) |
| `@sfdebug /reset` | Clear the current investigation and start fresh |


