# Changelog

All notable changes to the Salesforce Debug Agent extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-22

### Added
- Initial release of Salesforce Debug Agent extension
- **Core Features**:
  - Read-only Salesforce org investigation capability
  - AI-powered investigation planning using Anthropic Claude
  - Autonomous query execution and metadata retrieval
  - Root cause analysis with confidence levels
  - Three-document report generation (BU, Tech, Client)
  
- **Safety Layers**:
  - CLI command allowlist (only read-only operations)
  - DML scanner for Apex code validation
  - Path guard for file system protection
  - HQ2Prod guard for production org safety
  
- **Commands**:
  - `SF Debug: Configure Anthropic API Key` - Secure API key storage
  - `SF Debug: Start New Investigation` - Begin new investigation
  - `SF Debug: Approve Investigation Plan` - Review and approve plan
  - `SF Debug: Run Approved Queries` - Execute investigation
  - `SF Debug: Generate Report Bundle` - Create final reports
  
- **Investigation Features**:
  - UAQE context collection (org, symptom, objects, records)
  - Interactive plan review with webview
  - Step-by-step execution with progress tracking
  - Automated findings generation
  - Data vs system root cause determination
  
- **Reporting**:
  - Business User (BU) report - Plain language summary
  - Technical Document - Comprehensive evidence and analysis
  - Client report - Step-by-step resolution guide
  - Markdown format for easy sharing
  
- **Security**:
  - VS Code secret storage for API keys
  - Multi-layer command validation
  - Quarantined metadata retrieval
  - Production org confirmation dialogs
  - Comprehensive audit logging
  
- **Documentation**:
  - Complete README with setup instructions
  - Architecture documentation (docs/AGENTS.md)
  - Security documentation (docs/security.md)
  - Troubleshooting guide (docs/troubleshooting.md)
  - Agent templates and schemas
  
- **Developer Experience**:
  - TypeScript with strict mode
  - ESLint configuration
  - VS Code debugging configuration
  - Automated setup script
  - Comprehensive error handling

### Security
- All operations are read-only by design
- No deployment or DML capabilities
- Path traversal prevention
- API key encryption via VS Code secrets
- Production org safeguards

### Notes
- Requires VS Code 1.99.0 or higher
- Requires Salesforce CLI for org operations
- Language model provided by Copilot subscription, or Anthropic / Grok API key
- Tested with Claude Sonnet 4 model

## [Unreleased]

### Planned
- Investigation history and search
- Custom report templates
- Multi-org comparison
- Automated regression testing
- Integration with Salesforce DevOps Center
- VS Code Marketplace publication

## [2.0.0] - 2026-02-25

### Added
- **Copilot-Native Architecture** — extension now works like GitHub Copilot itself:
  - `@sfdebug` chat participant is the **primary** interface
  - Uses `vscode.lm.selectChatModels()` to leverage the user's Copilot subscription — **no API key required**
  - Tools registered via `vscode.lm.registerTool()` so any VS Code Language Model can invoke them
  - Tool calling via native `LanguageModelToolCallPart` / `LanguageModelToolResultPart` API
- **Registered Language Model Tools**:
  - `sfDebug_runSfCommand` — run read-only SF CLI commands
  - `sfDebug_writeFile` — write files to allowed workspace paths
  - `sfDebug_readFile` — read workspace files
  - `sfDebug_listDir` — list directory contents
- **VS Code LM Agent Loop** (`vscodeLmLoop.ts`) — agentic loop using VS Code's Language Model API with up to 20 iterations
- **Chat Tool Implementations** (`chatTools.ts`) — `vscode.LanguageModelTool<T>` implementations for all 4 tools
- New activation event: `onChatParticipant:sfDebug.agent`

### Changed
- **Primary interface** changed from sidebar webview to `@sfdebug` chat participant
- Sidebar webview is now a **secondary/fallback** interface for users without Copilot
- First-run prompt now checks for VS Code LM availability before suggesting API key setup
- Participant tries VS Code LM first, falls back to direct Anthropic/Grok API if unavailable
- Engine requirement bumped from `^1.94.0` to `^1.99.0` (for stable Language Model Tool API)
- Version bumped to 2.0.0

### Notes
- Fully backward-compatible: direct Anthropic (`sk-ant-`) and Grok (`xai-`) API keys still work as fallback
- Existing sidebar webview remains functional for non-Copilot users

---

**Legend**:
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements
