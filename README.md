# SF Debug Agent

An AI-powered Salesforce debugging assistant for VS Code. Describe your issue in plain English — the agent autonomously runs SF CLI commands, reads and writes files, and produces BU, Technical, and Client reports.

## Features

- 🤖 **Agentic Loop** — LLM autonomously plans and executes up to 20 tool calls per message
- 🔍 **SF CLI Integration** — runs `sf data query`, `sf apex run`, `sf project retrieve` on your behalf
- 📊 **Auto-generated Reports** — BU, Technical, and Client `.md` reports written to `runtime/Reports/`
- 🔒 **Safety Guardrails** — read-only CLI allowlist + write path protection (no deploys, no deletes)
- 🧠 **Dual LLM Support** — Anthropic Claude (`sk-ant-` key) or Grok (`xai-` key)
- 💾 **Persistent Memory** — conversation history stored per workspace (80-message rolling window)
- 🖼️ **Image Paste** — paste screenshots directly into the chat for visual context
- 💬 **Copilot Chat Participant** — also available as `@sfdebug` in GitHub Copilot Chat

## Getting Started

### Prerequisites

- Salesforce CLI installed and authenticated (`sf org list`)
- An API key from **Anthropic** (`sk-ant-...`) or **Grok / xAI** (`xai-...`)
- VS Code 1.85.0 or higher

### Initial Setup

1. Install the extension
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run: **`SF Debug: Configure API Key`**
4. Paste your Anthropic or Grok API key (stored securely in VS Code secrets)

## Usage

### Chat Panel

1. Open the **SF Debug** panel in the VS Code sidebar (or press `Cmd+Shift+P` → `SF Debug: Open Chat`)
2. Type your Salesforce issue in plain English, for example:

   > *"Users on the HQ2Prod org are getting a `FIELD_INTEGRITY_EXCEPTION` on Opportunity line items when the product family is 'Hardware'. Affects order IDs: 8013x000001abc, 8013x000001def"*

3. The agent will autonomously:
   - Run SOQL queries to gather evidence
   - Retrieve relevant metadata
   - Run Apex scripts if needed
   - Write BU, Technical, and Client reports to `runtime/Reports/`

### GitHub Copilot Chat

If you have GitHub Copilot Chat installed, mention `@sfdebug` in any chat:

```
@sfdebug Why are Opportunity line items failing validation on HQ2Prod?
```

Use `/reset` to clear the conversation history for the current workspace.

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

- Verify Salesforce CLI is installed: `sf --version`
- Verify org auth: `sf org list`
- Confirm API key is set: run `SF Debug: Configure API Key`

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

