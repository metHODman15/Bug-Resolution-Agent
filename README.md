# SF Debug Agent

A **Copilot-native** Salesforce debugging agent for VS Code. Type `@sfdebug` in the Chat panel, describe your issue in plain English, and the agent autonomously investigates your Salesforce org — running SF CLI commands, analysing data, and producing reports.

## Features

- 🚀 **Copilot-Native** — works inside VS Code's Chat panel, just like GitHub Copilot. No separate API key required when using a Copilot subscription.
- 🤖 **Agentic Loop** — LLM autonomously plans and executes up to 20 tool calls per message
- 🔧 **Registered VS Code Tools** — `sfDebug_runSfCommand`, `sfDebug_readFile`, `sfDebug_writeFile`, `sfDebug_listDir` are registered via `vscode.lm.registerTool()` so any language model can invoke them
- 🔍 **SF CLI Integration** — runs `sf data query`, `sf apex run`, `sf project retrieve` on your behalf
- 📊 **Auto-generated Reports** — BU, Technical, and Client `.md` reports written to `runtime/Reports/`
- 🔒 **Safety Guardrails** — read-only CLI allowlist + write path protection (no deploys, no deletes)
- 🧠 **Fallback LLM Support** — direct Anthropic Claude (`sk-ant-`) or Grok (`xai-`) keys when Copilot is unavailable
- 💾 **Persistent Memory** — conversation history stored per workspace (80-message rolling window)
- 🖼️ **Image Paste** — paste screenshots into the sidebar chat for visual context

## Getting Started

### Prerequisites

- **VS Code 1.99.0** or higher
- **Salesforce CLI** installed and authenticated (`sf org list`)
- **One of** the following language model providers:
  - ✅ **GitHub Copilot** subscription (recommended — no API key needed)
  - ✅ **Anthropic API key** (`sk-ant-...`) — [console.anthropic.com](https://console.anthropic.com)
  - ✅ **Grok / xAI API key** (`xai-...`) — [console.x.ai](https://console.x.ai)

### Initial Setup

#### With GitHub Copilot (recommended)

1. Install the extension
2. Open the Chat panel (`Cmd+Ctrl+I` / `Ctrl+Alt+I`)
3. Type `@sfdebug` and describe your issue — that's it!

#### Without Copilot (direct API key)

1. Install the extension
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run: **`SF Debug: Configure API Key`**
4. Paste your Anthropic or Grok API key (stored securely in VS Code secrets)

## Usage

### Primary: VS Code Chat Panel (`@sfdebug`)

1. Open the Chat panel — click the chat icon in the Activity Bar, or press `Cmd+Ctrl+I` (macOS) / `Ctrl+Alt+I` (Windows/Linux)
2. Type `@sfdebug` followed by your Salesforce issue in plain English:

   ```
   @sfdebug Users on the HQ2Prod org are getting a FIELD_INTEGRITY_EXCEPTION on Opportunity line items when the product family is 'Hardware'. Affects order IDs: 8013x000001abc, 8013x000001def
   ```

3. The agent will autonomously:
   - Run SOQL queries to gather evidence
   - Retrieve relevant metadata
   - Run Apex scripts if needed
   - Write BU, Technical, and Client reports to `runtime/Reports/`

Use `/reset` to clear the conversation history for the current workspace.

### Secondary: Sidebar Chat Panel

The sidebar webview is available for users without Copilot. It uses a direct Anthropic or Grok API key and supports image paste.

### Generated Reports

All reports are written to `runtime/Reports/`:

| File | Audience | Contents |
|------|----------|----------|
| `BU.md` | Business stakeholders | Plain-language summary, business impact |
| `Tech Document.md` | Engineers | Query results, metadata, root cause |
| `Client.md` | Clients | Action items, example records, resolution steps |

## Safety Features

### Allowed CLI Commands

Only these Salesforce CLI operations are permitted:

| Command | Flags |
|---------|-------|
| `sf data query` | `--query` or `--file`, must include `--json` |
| `sf apex run` | `--file` only (read-only Apex) |
| `sf project retrieve start` | `--metadata`, `-m`, or `--source-dir` |

All other commands (deploy, push, delete, create, update, upsert, etc.) are **blocked**.

### DML Protection

Apex scripts containing any DML keywords are automatically rejected before execution:
- `INSERT`, `UPDATE`, `DELETE`, `UPSERT`, `UNDELETE`, `MERGE`
- `Database.insert`, `Database.update`, `Database.delete`, etc.

### Write Path Protection

File writes are restricted to these directories:
- `runtime/scripts/`
- `runtime/agent_workspace/`
- `runtime/Reports/`

## Configuration

The extension stores only your API key. There are no workflow settings to configure — the agent handles everything autonomously.

To change your API key, re-run **`SF Debug: Configure API Key`**.

## Development

### Building from Source

```bash
npm install
npm run compile
```

### Packaging

```bash
npm install -g @vscode/vsce
vsce package
```

### Running Tests

```bash
npm test
```

## Security

- API keys stored in VS Code's secure secret storage (never in plain text)
- All SF CLI operations are read-only by default
- No deployment or data modification is possible through the agent
- File writes are sandbox-restricted to `runtime/`

## Troubleshooting

### Extension Not Activating

- Verify VS Code 1.99+ is installed: **Help → About**
- Verify Salesforce CLI is installed: `sf --version`
- Verify org auth: `sf org list`
- If using direct API mode: run `SF Debug: Configure API Key`
- If using Copilot mode: ensure GitHub Copilot is active

### Agent Blocked on Queries

- Ensure your query includes `--json` — the allowlist requires it
- Use `--query "SELECT..."` or `--file path/to/query.soql`

### Permission Errors from Salesforce

Your Salesforce user needs:
- Read access to the objects being queried
- API Enabled permission
- View Setup and Configuration (for metadata retrieval)

### Logs and Artifacts

Raw CLI outputs and intermediate files are written to `runtime/agent_workspace/`:

- `logs/` — raw SF CLI outputs
- `findings/` — agent notes
- `plans/` — investigation plans
- `md/` — retrieved metadata
- `scripts/` — generated SOQL and Apex files

## License

Proprietary — Akatsuki Enterprises

