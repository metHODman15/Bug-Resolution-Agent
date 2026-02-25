# Agent System Architecture

## Overview

The SF Debug Agent is an autonomous VS Code extension that performs read-only Salesforce debugging investigations. The user types a problem in plain English; the LLM autonomously plans and executes SF CLI commands, reads and writes files, and produces reports — all within a single agentic loop, without any multi-step approval workflow.

---

## Architecture

```
User message
     │
     ▼
WebviewProvider / Participant
     │  sends message text + conversation history
     ▼
runAgentLoop()  ──── toolEngine.ts ────────────────────────────────────┐
     │                                                                  │
     │  LLM (Anthropic Claude or Grok)                                 │
     │  ← system instructions (AGENTS.md + copilot-instructions.md)   │
     │  ← full conversation history (ConversationMemory)               │
     │                                                                  │
     │  Tool calls (up to 20 iterations):                              │
     │    run_sf_command  →  CliAllowlist + SfCliRunner                │
     │    write_file      →  PathGuard                                 │
     │    read_file                                                     │
     │    list_dir                                                      │
     │                                                                  │
     └── streams tokens back to UI as they arrive ─────────────────────┘
```

---

## Key Files

### Entry Point

**`extension/src/extension.ts`**
- Activates on VS Code startup
- Registers `sfDebug.configureApiKey` command
- Instantiates `SfDebugWebviewProvider` and `registerParticipant`
- Prompts for API key on first run (supports `sk-ant-` and `xai-` keys)

---

### UI Layer

**`extension/src/chat/webviewProvider.ts`** — primary interface
- Renders the SF Debug panel in the VS Code secondary sidebar (`sfDebug.chatView`)
- Sends user messages to `runAgentLoop()` and streams the response back
- Shows live tool call / result banners during execution
- Supports image paste (`Cmd+V`) for screenshot context
- Displays API key banner if no key is configured

**`extension/src/chat/participant.ts`** — `@sfdebug` Copilot Chat participant
- Routes `@sfdebug` mentions in GitHub Copilot Chat to the same `runAgentLoop()`
- Shares `ConversationMemory` with the webview (same workspace state)
- Handles `/reset` slash command; all other messages go through the full agent loop

---

### Agentic Core

**`extension/src/agent/tools/toolEngine.ts`**

The heart of the system. `runAgentLoop(message, history, context, onChunk)`:

1. Prepends system instructions to the message
2. Calls the LLM (Anthropic `beta.tools` API or OpenAI-compatible Grok)
3. If the LLM returns a tool call, executes it and feeds the result back
4. Repeats up to **20 iterations**
5. Streams text tokens to the UI via the `onChunk` callback

**LLM providers:**
| Provider | Model | Key prefix | API |
|----------|-------|------------|-----|
| Anthropic | `claude-sonnet-4-20250514` | `sk-ant-` | `client.beta.tools.messages.create` |
| Grok / xAI | `grok-3` | `xai-` | OpenAI-compatible at `https://api.x.ai/v1` |

**Available tools:**
| Tool | Description |
|------|-------------|
| `run_sf_command` | Runs an SF CLI command (gated by `CliAllowlist`) |
| `write_file` | Writes a file (gated by `PathGuard`) |
| `read_file` | Reads any file in the workspace |
| `list_dir` | Lists directory contents |

---

### Memory

**`extension/src/agent/memory/conversationMemory.ts`**
- Stores conversation history in `vscode.ExtensionContext.workspaceState`
- Key: `sf-debug-chat-history` (scoped to the current workspace folder automatically)
- Rolling window: keeps last **80 messages**
- `load()` / `save()` / `clear()` / `count()` API

---

### Safety Layer

**`extension/src/agent/safety/cliAllowlist.ts`**
- Only three SF CLI command families are allowed:
  - `sf data query` — must include `--query` or `--file`, and `--json`
  - `sf apex run` — must use `--file` (prevents inline Apex injection)
  - `sf project retrieve start` — must specify metadata target
- All deploy, push, delete, create, update, upsert operations are **blocked**

**`extension/src/agent/safety/dmlScanner.ts`**
- Scans Apex files for DML keywords before execution
- Blocks: `INSERT`, `UPDATE`, `DELETE`, `UPSERT`, `UNDELETE`, `MERGE`, `Database.*`

**`extension/src/agent/safety/pathGuard.ts`**
- Restricts `write_file` to:
  - `runtime/scripts/`
  - `runtime/agent_workspace/`
  - `runtime/Reports/`

**`extension/src/agent/safety/hq2prodGuard.ts`**
- Extra confirmation step when the target org alias is `HQ2Prod`

---

### Instructions

**`extension/src/agent/instructions.ts`**
- Loads system instructions at runtime from:
  - `copilot-reference-mds/AGENTS.md`
  - `copilot-reference-mds/copilot-instructions.md`
- `getSystemInstructions()` — full agent persona and rules
- `getAnalysisInstructions()` — analysis-specific sub-prompt

---

### Execution

**`extension/src/agent/execution/sfCliRunner.ts`**
- Shells out to `sf` CLI for allowed commands
- Logs all raw outputs to `runtime/agent_workspace/logs/`

---

## Data Flow: Example Investigation

```
User: "Opportunity line items failing on HQ2Prod with FIELD_INTEGRITY_EXCEPTION"
  │
  ▼
runAgentLoop()
  ├─ [tool] run_sf_command: sf data query --query "SELECT Id, ... FROM OpportunityLineItem WHERE..." --json --target-org HQ2Prod
  ├─ [tool] run_sf_command: sf project retrieve start --metadata ValidationRule:Opportunity --target-org HQ2Prod
  ├─ [tool] read_file: runtime/agent_workspace/md/ValidationRule-Opportunity.xml
  ├─ [tool] write_file: runtime/Reports/BU.md
  ├─ [tool] write_file: runtime/Reports/Tech Document.md
  └─ [tool] write_file: runtime/Reports/Client.md
  │
  ▼
Final text response streamed to chat panel
```

---

## What Was Removed

The following files/components from the original architecture **no longer exist** in the active codebase. They remain on disk as legacy artifacts but are not imported or used:

- `agent/planner.ts` — planning is now done inline by the LLM
- `agent/analyzer.ts` — analysis is done inline by the LLM
- `agent/state.ts` — state is now `ConversationMemory`
- `agent/tokenTracker.ts` — no longer used
- `commands/startInvestigation.ts` — removed (no multi-step workflow)
- `commands/approvePlan.ts` — removed
- `commands/runQueries.ts` — removed
- `commands/generateReports.ts` — removed
- `reporting/buWriter.ts`, `techWriter.ts`, `clientWriter.ts` — LLM writes reports directly via `write_file` tool
- `service_python/` — Python microservice removed entirely
- `services/pythonBridge.ts` — removed
- Example records with field values
- Verification steps
- Escalation guidance

## Data Flow

```
User Input (UAQE)
    ↓
Planner (AI-generated plan)
    ↓
Approval (User review)
    ↓
SfCliRunner (Execute steps)
    ↓
Safety Guards (Validate each operation)
    ↓
Analyzer (Interpret results)
    ↓
Report Writers (Generate 3 documents)
    ↓
User Review (Opens in editor)
```

## Safety Architecture

### Multi-Layer Protection

1. **Command Layer**: Allowlist of permitted CLI commands
2. **Code Layer**: DML scanning for Apex scripts
3. **File Layer**: Path restrictions for all I/O
4. **Org Layer**: Special production org handling

### Non-Modifiable Instructions

The AI agent's system instructions are embedded in `agent/instructions.ts`:
- `SYSTEM_INSTRUCTIONS`: Controls planning behavior and safety
- `ANALYSIS_INSTRUCTIONS`: Controls analysis and root cause determination  
- `REPORT_INSTRUCTIONS`: Controls report generation formatting

These constants are:
- Compiled into the extension binary
- Not accessible through settings or UI
- Not modifiable by end users
- Provide consistent agent behavior

**Developer Access**: Instructions can be modified in source code for updates, but require thorough testing.

## Folder Structure

### Source Code (Shipped)
```
extension/src/
  ├── extension.ts          # Entry point
  ├── commands/             # User commands
  ├── agent/
  │   ├── state.ts          # State management
  │   ├── planner.ts        # Plan generation
  │   ├── safety/           # Safety guards
  │   ├── execution/        # CLI execution
  │   ├── analysis/         # Result analysis
  │   └── reporting/        # Report generation
  └── schemas/              # JSON schemas
```

### Templates (Versioned)
```
agent_templates/
  ├── plans/                # Plan templates
  ├── queries/              # Common SOQL queries
  └── reports/              # Report templates
```

### Runtime (Gitignored)
```
runtime/
  ├── agent_workspace/
  │   ├── logs/             # CLI output logs
  │   ├── findings/         # Analysis findings
  │   ├── plans/            # Generated plans
  │   ├── web/              # Web research notes
  │   └── md/               # Quarantined metadata
  ├── Reports/              # Generated reports
  └── scripts/              # Generated SOQL/Apex
```

## AI Integration

### Anthropic Claude Usage

1. **Plan Generation**
   - Input: Investigation context (UAQE)
   - Output: Structured step list
   - Model: Claude Sonnet 4

2. **Result Analysis**
   - Input: Step output + context
   - Output: Structured findings
   - Model: Claude Sonnet 4

3. **Root Cause Determination**
   - Input: All findings + context
   - Output: Root cause analysis with confidence + UI action plan (if needed)
   - Model: Claude Sonnet 4

4. **UI Action Plan Generation**
   - Triggered: When root cause requires interface changes
   - Output: Step-by-step navigation and configuration instructions
   - Display: Chat panel + Tech Document.md section
   - Format: Structured steps with verification criteria

### Knowledge Reuse & Learning

**Resolution Cards**:
- Issue fingerprinting using symptom + object + record hashes
- Storage of successful solutions with confidence scores
- Reuse for similar issues (>80% confidence threshold)
- Continuous learning from each investigation

**Prompt Optimization**:
- Bounded input limits (600 char summary + 5×450 char snippets)
- Local summarization before API calls
- Caching of session summaries
- Cost reduction up to 90% for repeated issues

### Hidden Instructions

The agent's behavior is guided by system prompts that:
- Are embedded in TypeScript source
- Are not modifiable by end-users
- Define read-only operation boundaries
- Structure output formats
- Guide reasoning process

## Security Considerations

### API Key Storage
- Stored in VS Code secure secret storage
- Never logged or exposed in UI
- Validated on input

### Production Safeguards
- Special `HQ2Prod` handling
- Confirmation dialogs
- Enhanced audit logging
- Visual warnings

### File System Protection
- All writes to `runtime/` only
- No access to source directories
- Quarantined metadata retrieval
- Path traversal prevention

### Command Execution
- Allowlist only
- No shell injection
- JSON output parsing only
- Logged for audit

## Extensibility

### Adding New Safety Guards

1. Create guard in `agent/safety/`
2. Implement validation logic
3. Integrate into `SfCliRunner`
4. Add tests

### Adding New Report Types

1. Create writer in `agent/reporting/`
2. Implement `writeReport()` method
3. Add to `generateReports` command
4. Create template in `agent_templates/`

### Customizing AI Behavior

1. Update system prompts in `planner.ts` or `analyzer.ts`
2. Test thoroughly with various scenarios
3. Ensure safety boundaries maintained
4. Document changes

## Testing Strategy

### Unit Tests
- Safety guard validation
- Path sanitization
- Command parsing
- DML detection

### Integration Tests
- Full investigation flow
- CLI command execution
- Report generation
- State management

### Manual Testing
- Real Salesforce org access
- Various issue types
- Production org handling
- Error scenarios

## Performance Considerations

### AI API Calls
- Plan: 1 call per investigation
- Analysis: 1 call per step
- Root cause: 1 call per investigation
- Total: ~5-10 calls per investigation

### CLI Execution
- Sequential step execution
- JSON output for parsing
- Logged for audit trail
- Timeout handling

### File I/O
- Minimal writes during investigation
- Bulk report generation at end
- Quarantined metadata storage
- Log rotation considerations

## Future Enhancements

### Potential Features
- Investigation history/search
- Automated regression testing
- Trend analysis across investigations
- Integration with case management
- Multi-org comparison
- Scheduled health checks

### Architecture Improvements
- Plugin system for custom analyzers
- Configurable safety policies
- Custom report templates
- Team sharing of findings
- Integration with CI/CD

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify key format (sk-ant-...)
   - Check secret storage
   - Reconfigure if needed

2. **CLI Commands Failing**
   - Verify Salesforce CLI installed
   - Check org authentication
   - Review command allowlist

3. **Reports Not Generating**
   - Check runtime/ directory permissions
   - Verify investigation completed
   - Review error logs

4. **DML Detected Incorrectly**
   - Review Apex code normalization
   - Check for false positives
   - Update scanner logic if needed

## Maintenance

### Regular Tasks
- Update Anthropic SDK
- Review and update safety guards
- Test against new Salesforce CLI versions
- Update documentation
- Review and improve AI prompts

### Monitoring
- Track investigation success rates
- Monitor API usage
- Review safety guard blocks
- Analyze common failure patterns
