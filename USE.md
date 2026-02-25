# Using the SF Debug Agent

## Installation

1. In VS Code, open the Extensions view and select **⋯ → Install from VSIX...**
2. Pick the `extension.vsix` file
3. Reload VS Code when prompted

## Configure Your API Key

Open the Command Palette (`Cmd+Shift+P`) and run **SF Debug: Configure API Key**.

Enter either:
- An **Anthropic** key starting with `sk-ant-`
- A **Grok / xAI** key starting with `xai-`

The key is stored securely in VS Code Secret Storage and never written to disk.

## Start Debugging

Open the **SF Debug** panel in the VS Code sidebar. Type your issue in plain English:

> *"Users on HQ2Prod are hitting a FIELD_INTEGRITY_EXCEPTION when saving Opportunity line items for product family 'Hardware'. Example records: 8013x000001abc, 8013x000001def"*

The agent will autonomously:
1. Query Salesforce to gather evidence (`sf data query`)
2. Retrieve relevant metadata (`sf project retrieve`)
3. Run read-only Apex if needed (`sf apex run`)
4. Write `BU.md`, `Tech Document.md`, and `Client.md` to `runtime/Reports/`

No approvals, no multi-step workflow — just ask and the agent acts.

## Using with GitHub Copilot Chat

If you have GitHub Copilot Chat installed, type `@sfdebug` in any chat window:

```
@sfdebug Debug the validation rule failure on the Account object in staging
```

Use `/reset` to clear the conversation history for the current workspace.

## Image / Screenshot Paste

You can paste screenshots directly into the chat panel (`Cmd+V`). This is useful for sharing error messages or UI state with the agent.

## Conversation Memory

The agent remembers your conversation **per workspace** (up to 80 messages). When you switch to a different project folder, the history resets automatically. Use `/reset` in the chat to clear history manually.

## Report Locations

| File | Location |
|------|----------|
| Business Unit report | `runtime/Reports/BU.md` |
| Technical report | `runtime/Reports/Tech Document.md` |
| Client report | `runtime/Reports/Client.md` |
| CLI logs | `runtime/agent_workspace/logs/` |
| Query scripts | `runtime/agent_workspace/scripts/` |

## Troubleshooting

**Extension not activating**
- Ensure Salesforce CLI is installed: `sf --version`
- Ensure at least one org is authenticated: `sf org list`

**Agent says my command is blocked**
- The allowlist only permits read-only SF CLI commands
- Queries must include `--json` (the agent does this automatically)

**No reports generated**
- Check `runtime/Reports/` — the agent writes files there after analysis
- If blank, re-state the issue with example record IDs so the agent has something to query

- Open Developer Tools (Help → Toggle Developer Tools) to view console errors from the extension host.
- If commands do not appear, reload the window (Cmd/Ctrl+Shift+P → "Developer: Reload Window").

Uninstall
- Open the Extensions view, find the Salesforce Debug Agent, and click the gear → Uninstall.

Advanced / developer
- If you are working in the source repository and want to run or test locally:
  ```bash
  cd WorkSpace
  npm install
  npm run compile
  npm test
  ```

Support
- If you encounter issues, include the following when reporting:
  - VS Code version
  - OS and Python version (`python3 --version`)
  - The extension output log (Output → Salesforce Debug Agent)

File locations of interest
- Extension source: `extension/` (TypeScript)
- Python microservice: `service_python/`
- Compiled extension entry: `out/extension.js`
