# Salesforce Debug Agent - VS Code Extension

## 🎯 Project Overview

A VS Code extension that provides **autonomous, read-only debugging** capabilities for Salesforce orgs using AI-powered investigation planning and analysis.

### Key Features

✅ **Read-Only by Design** - No deployment, no DML, no modifications
✅ **AI-Powered** - Uses Anthropic Claude for intelligent investigation planning
✅ **Multi-Layer Safety** - Command allowlist, DML scanning, path guards, production protection
✅ **Comprehensive Reports** - Generates 3 audience-specific documents per investigation
✅ **Hidden Instructions** - Agent behavior is embedded and non-modifiable by end users
✅ **Production Ready** - Special safeguards for HQ2Prod and production orgs

---

## 📁 Project Structure

```
WorkSpace/
├── extension/src/              # Extension source code (TypeScript)
│   ├── extension.ts            # Entry point, command registration
│   ├── commands/               # User-facing commands
│   │   ├── configureApiKey.ts
│   │   ├── startInvestigation.ts
│   │   ├── approvePlan.ts
│   │   ├── runQueries.ts
│   │   └── generateReports.ts
│   ├── agent/                  # Agent system
│   │   ├── state.ts            # State management
│   │   ├── planner.ts          # AI-powered plan generation
│   │   ├── safety/             # Safety guards
│   │   │   ├── cliAllowlist.ts
│   │   │   ├── dmlScanner.ts
│   │   │   ├── pathGuard.ts
│   │   │   └── hq2prodGuard.ts
│   │   ├── execution/          # CLI execution
│   │   │   └── sfCliRunner.ts
│   │   ├── analysis/           # Result analysis
│   │   │   └── analyzer.ts
│   │   └── reporting/          # Report generation
│   │       ├── buWriter.ts
│   │       ├── techWriter.ts
│   │       └── clientWriter.ts
│   └── schemas/                # JSON schemas
│       ├── findings.schema.json
│       └── plan.schema.json
│
├── agent_templates/            # Versioned templates
│   ├── plans/
│   │   └── default-plan.md
│   ├── queries/common/
│   │   ├── field_permissions.soql
│   │   └── object_permissions.soql
│   └── reports/
│       ├── BU.template.md
│       ├── Tech.template.md
│       └── Client.template.md
│
├── runtime/                    # Generated content (gitignored)
│   ├── agent_workspace/
│   │   ├── logs/
│   │   ├── findings/
│   │   ├── plans/
│   │   ├── web/
│   │   └── md/
│   ├── Reports/
│   └── scripts/
│       ├── soql/
│       └── apex/
│
├── docs/                       # Documentation
│   ├── AGENTS.md               # Architecture deep-dive
│   ├── security.md             # Security documentation
│   └── troubleshooting.md      # Common issues & solutions
│
├── .vscode/                    # VS Code configuration
│   ├── settings.json
│   ├── launch.json
│   ├── tasks.json
│   └── extensions.json
│
├── package.json                # Extension manifest
├── tsconfig.json               # TypeScript configuration
├── .eslintrc.json              # ESLint rules
├── .gitignore                  # Git ignore patterns
├── .vscodeignore               # VS Code package ignore
├── README.md                   # User documentation
├── QUICKSTART.md               # Quick start guide
├── CHANGELOG.md                # Version history
├── LICENSE                     # MIT License
└── setup.sh                    # Automated setup script
```

---

## 🔒 Security Architecture

### Layer 1: CLI Allowlist
Only these Salesforce CLI commands can execute:
- `sf data query --file <path> --json`
- `sf apex run --file <path>` (read-only only)
- `sf project retrieve start ...` (quarantined output)

**Blocks**: deploy, push, delete, update, insert, upsert, undelete

### Layer 2: DML Scanner
Scans all Apex code for:
- Direct DML keywords (insert, update, delete, etc.)
- Database.* methods
- HTTP callouts

**Result**: Execution blocked if any DML detected

### Layer 3: Path Guard
Restricts file operations to:
- ✅ `runtime/scripts/`
- ✅ `runtime/agent_workspace/`
- ✅ `runtime/Reports/`

**Blocks**: Writes to source code, deployment folders, system directories

### Layer 4: HQ2Prod Guard
Special protection for production orgs:
- Confirmation dialogs
- Enhanced logging
- Visual warnings
- Audit trail

---

## 🤖 AI Agent System

### Hidden Instructions

The agent's behavior is guided by system prompts embedded in:
- **Planner** (`planner.ts`): Generates read-only investigation plans
- **Analyzer** (`analyzer.ts`): Interprets results and determines root cause

These instructions are:
- ❌ Not accessible to end users
- ❌ Not modifiable through settings
- ❌ Not exposed in UI
- ✅ Compiled into extension binary
- ✅ Define strict read-only boundaries

### Agent Workflow

```
1. User Input (UAQE)
   ↓
2. Planner → AI generates investigation plan
   ↓
3. User Approval → Review plan in webview
   ↓
4. Execution → SfCliRunner executes steps
   ↓ (each step validated by safety guards)
5. Analysis → Analyzer interprets results
   ↓
6. Reports → Generate 3 documents (BU, Tech, Client)
   ↓
7. User Review → Opens in editor
```

---

## 📋 User Commands

### 1. Configure Anthropic API Key
- **Command**: `SF Debug: Configure Anthropic API Key`
- **Purpose**: Securely store API key in VS Code secrets
- **When**: First time setup or key rotation

### 2. Start New Investigation
- **Command**: `SF Debug: Start New Investigation`
- **Purpose**: Begin a new debugging investigation
- **Collects**:
  - Org alias
  - Symptom/error description
  - Impacted object/feature
  - Impacted users/profiles
  - 3-10 example record IDs/URLs

### 3. Approve Investigation Plan
- **Command**: `SF Debug: Approve Investigation Plan`
- **Purpose**: Review and approve AI-generated plan
- **Shows**: Steps, commands, expected outputs

### 4. Run Approved Queries
- **Command**: `SF Debug: Run Approved Queries`
- **Purpose**: Execute investigation steps
- **Actions**:
  - Runs SOQL queries
  - Retrieves metadata
  - Analyzes results
  - Determines root cause

### 5. Generate Report Bundle
- **Command**: `SF Debug: Generate Report Bundle`
- **Purpose**: Create final reports
- **Outputs**:
  - `BU.md` - Business user summary
  - `Tech Document.md` - Technical evidence
  - `Client.md` - Resolution guide

---

## 📊 Report Types

### BU.md (Business User Report)
- **Audience**: Business stakeholders, managers
- **Language**: Plain language, no technical jargon
- **Content**:
  - What happened
  - Why it happened
  - What needs to be done
  - Impact summary
- **Use Case**: Executive summary, user communication

### Tech Document.md (Technical Report)
- **Audience**: Salesforce developers, admins
- **Language**: Technical details, evidence
- **Content**:
  - Investigation plan executed
  - All findings (data, metadata, permissions, automation)
  - Root cause analysis with confidence
  - Query results and metadata analysis
  - Artifact locations
- **Use Case**: Deep troubleshooting, documentation, knowledge base

### Client.md (Client-Facing Report)
- **Audience**: End users, support teams
- **Language**: Step-by-step instructions
- **Content**:
  - How to resolve (numbered steps)
  - Recommended field changes per record
  - How to verify the fix
  - When to escalate
  - Prevention guidance
- **Use Case**: Resolution guide, support documentation, user enablement

---

## 🚀 Setup & Installation

### Prerequisites
- VS Code 1.85.0+
- Node.js v16+
- npm
- Salesforce CLI (recommended)
- Anthropic API key

### Quick Setup

```bash
# 1. Navigate to project
cd WorkSpace

# 2. Run setup script
./setup.sh

# 3. Open in VS Code
code .

# 4. Press F5 to launch extension

# 5. In new window, configure API key
# Command: SF Debug: Configure Anthropic API Key
```

### Manual Setup

```bash
npm install
npm run compile
mkdir -p runtime/agent_workspace/{logs,findings,plans,web,md}
mkdir -p runtime/Reports
mkdir -p runtime/scripts/{soql,apex}
```

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | User guide, features, setup |
| [QUICKSTART.md](QUICKSTART.md) | 5-minute quick start |
| [docs/AGENTS.md](docs/AGENTS.md) | Architecture deep-dive |
| [docs/security.md](docs/security.md) | Security layers, threat model |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common issues, solutions |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## 🔧 Development

### Build & Test

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-recompile)
npm run watch

# Run linter
npm run lint

# Run tests (when implemented)
npm test
```

### Debug Extension

1. Open project in VS Code
2. Press **F5**
3. New "Extension Development Host" window opens
4. Set breakpoints in TypeScript files
5. Debug normally

### VS Code Tasks

- **Build** (Cmd+Shift+B): Compile TypeScript
- **Watch**: Continuous compilation
- **Lint**: Check code quality

---

## 🔐 Security Notes

### API Key Storage
- Stored in VS Code secure secret storage
- Platform-specific encryption (Keychain/Credential Manager)
- Never logged or exposed

### Read-Only Operations
- No `sf project deploy` ever executed
- No DML in Apex scripts allowed
- Metadata retrieved to quarantine only
- All file writes restricted to `runtime/`

### Production Protection
- `HQ2Prod` triggers special handling
- Confirmation dialogs required
- Enhanced logging and audit trail
- Visual warnings in status bar

### Data Privacy
- Investigation artifacts stored locally only
- Query results sent to Anthropic for analysis
- User controls API key and data sharing
- Reports may contain sensitive data - share appropriately

---

## 🎨 Customization

### Settings

Access via VS Code Settings → `SF Debug`:

- `defaultOrgAlias` - Default org for investigations
- `maxRetryAttempts` - Loop-breaker threshold (default: 2)
- `enableWebSearch` - Web search on failure (default: true)

### Templates

Customize report templates in:
- `agent_templates/reports/BU.template.md`
- `agent_templates/reports/Tech.template.md`
- `agent_templates/reports/Client.template.md`

### Safety Guards

**⚠️ Warning**: Modifying safety guards reduces security. Only do so with full understanding of implications.

To customize:
1. Edit guard files in `extension/src/agent/safety/`
2. Add tests to verify safety
3. Document changes

---

## 📦 Packaging for Distribution

### Create Extension Package

```bash
# Install vsce
npm install -g @vscode/vsce

# Package extension
vsce package

# Produces: sf-debug-agent-1.0.0.vsix
```

### Install Packaged Extension

```bash
# Install .vsix file
code --install-extension sf-debug-agent-1.0.0.vsix
```

### Publish to Marketplace

```bash
# Create publisher (first time)
vsce create-publisher akatsuki-enterprises

# Login
vsce login akatsuki-enterprises

# Publish
vsce publish
```

---

## 🐛 Known Limitations

### Cannot Investigate
- Orgs without API access
- Orgs without CLI authentication
- Objects without read permission
- Deleted or archived records
- Orgs with IP restrictions (unless on allowlist)

### AI Limitations
- Confidence varies by complexity
- May require good symptom descriptions
- Token limits apply (~4K response)
- Cannot access non-queryable metadata

### Performance
- Max 10 example records per investigation
- Max 15 steps per plan
- Sequential step execution
- Large query results may timeout

---

## 🤝 Contributing

### Areas for Contribution

1. **Features**
   - Investigation history/search
   - Custom report formats
   - Multi-org comparison
   - Scheduled health checks

2. **Safety**
   - Additional guard patterns
   - Improved DML detection
   - Better false positive handling

3. **Documentation**
   - More examples
   - Video tutorials
   - Translation to other languages

4. **Testing**
   - Unit tests for guards
   - Integration tests
   - Real-world scenarios

### Contribution Process

1. Fork repository
2. Create feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

---

## 📞 Support

### Getting Help

1. **Read Documentation**: Start with README and QUICKSTART
2. **Check Troubleshooting**: See [docs/troubleshooting.md](docs/troubleshooting.md)
3. **Search Issues**: Check existing GitHub issues
4. **Ask Community**: Stack Overflow with tag `salesforce-debugging-agent`
5. **File Issue**: GitHub Issues with full context

### Reporting Issues

Include:
- Extension version
- VS Code version
- Salesforce CLI version
- Error messages (full text)
- Steps to reproduce
- Logs from `runtime/agent_workspace/logs/`
- Expected vs actual behavior

### Security Issues

See [docs/security.md](docs/security.md) for responsible disclosure process.

---

## 📜 License

MIT License - See [LICENSE](LICENSE) file

Copyright © 2026 Akatsuki Enterprises

---

## 🎯 Quick Reference

### File a Salesforce Developer Can Access

✅ **Full Access**:
- `package.json` - Extension configuration
- `tsconfig.json` - TypeScript settings
- `.eslintrc.json` - Linting rules
- `README.md` - User documentation
- `QUICKSTART.md` - Quick start guide
- `CHANGELOG.md` - Version history
- `docs/*` - All documentation
- `agent_templates/*` - Templates and queries
- `.vscode/*` - VS Code settings
- `runtime/*` - Investigation artifacts
- All TypeScript source in `extension/src/` (visible but...)

❌ **Hidden/Non-Modifiable**:
- Agent system prompts (embedded in compiled code)
- AI instructions (in `planner.ts` and `analyzer.ts` source, but behavior is set)
- Safety guard logic (modifiable but **strongly discouraged**)

### UI Changes Guidance

When UI changes are needed (e.g., adding fields, modifying webviews):

1. **In Chat**: Extension guides step-by-step
2. **In Tech Doc**: Includes code snippets and file locations
3. **Developer Access**: Full TypeScript source to modify
4. **Safety Preserved**: Guards remain active regardless of UI changes

---

## ✨ What Makes This Special

1. **Truly Read-Only** - Multiple overlapping safety layers
2. **AI-Powered** - Intelligent investigation planning
3. **Hidden Instructions** - Agent behavior is locked and secured
4. **Multi-Audience** - 3 different report formats
5. **Production Safe** - Special handling for critical orgs
6. **Developer Friendly** - Full TypeScript access
7. **User Accessible** - All files except agent instructions
8. **Audit Trail** - Complete logging of all operations

---

**Built with ❤️ for Salesforce Developers and Administrators**
