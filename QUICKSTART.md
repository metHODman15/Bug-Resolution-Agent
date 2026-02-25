# Quick Start Guide

Get up and running with the Salesforce Debug Agent in 5 minutes.

## Prerequisites

✅ **Required**:
- VS Code 1.85.0 or higher
- Node.js v16 or higher
- npm
- Anthropic API key ([Get one here](https://console.anthropic.com/))

✅ **Recommended**:
- Salesforce CLI installed
- Authenticated Salesforce org (sandbox recommended for testing)

## Installation

### Step 1: Setup

```bash
# Clone or open the project
cd /path/to/sf-debug-agent

# Run setup script (creates directories, installs deps, compiles)
./setup.sh
```

**Windows users**: Run these commands manually:
```cmd
npm install
npm run compile
mkdir runtime\agent_workspace\logs
mkdir runtime\agent_workspace\findings
mkdir runtime\Reports
mkdir runtime\scripts\soql
mkdir runtime\scripts\apex
```

### Step 2: Open in VS Code

1. Open this folder in VS Code
2. Press **F5** to launch the extension in debug mode
3. A new "Extension Development Host" window will open

### Step 3: Configure API Key

In the new VS Code window:

1. Open Command Palette: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: `SF Debug: Configure Anthropic API Key`
3. Enter your API key (starts with `sk-ant-...`)
4. Key is stored securely in VS Code secrets ✓

### Step 4: Authenticate Salesforce Org

Open a terminal and authenticate to your Salesforce org:

```bash
# Web login (opens browser)
sf org login web -a myOrg

# Or use existing auth
sf org list

# Verify access
sf org display -o myOrg
```

## Your First Investigation

### Step 1: Start Investigation

1. Command Palette → `SF Debug: Start New Investigation`
2. Fill in the prompts:

**Example Investigation**:
```
Org Alias: myOrg
Symptom: Account record not updating when saved
Impacted Object: Account
Impacted Users: Sales Users
Example Records: 001XXXXXXXXXXXXXXX, 001YYYYYYYYYYYYYYY
```

### Step 2: Review Plan

- A webview opens showing the investigation plan
- Review each step (queries, metadata retrieval, analysis)
- All operations are read-only ✓

### Step 3: Approve Plan

1. Command Palette → `SF Debug: Approve Investigation Plan`
2. Confirm approval in the dialog

### Step 4: Execute Investigation

1. Command Palette → `SF Debug: Run Approved Queries`
2. Watch progress in the notification
3. Steps execute one by one
4. Findings are collected and analyzed

### Step 5: View Reports

1. Command Palette → `SF Debug: Generate Report Bundle`
2. Three reports open automatically:
   - **BU.md** - Business user summary
   - **Tech Document.md** - Technical evidence
   - **Client.md** - Resolution steps

## Understanding the Reports

### BU.md (Business User Report)
- **Audience**: Business stakeholders
- **Language**: Plain language, no jargon
- **Focus**: What happened, why, and what to do
- **Use For**: Executive summary, user communication

### Tech Document.md (Technical Report)
- **Audience**: Salesforce developers/admins
- **Language**: Technical details
- **Focus**: Evidence, queries, metadata, root cause
- **Use For**: Deep analysis, troubleshooting, documentation

### Client.md (Client Report)
- **Audience**: End users, support teams
- **Language**: Step-by-step instructions
- **Focus**: How to fix, verify, and prevent
- **Use For**: Resolution guide, user instructions

## Investigating Common Issues

### Validation Rule Blocking Save

```
Symptom: "Validation rule error when saving Account"
Object: Account
Records: [IDs of accounts that fail]
```

**Expected Findings**:
- Validation rule criteria
- Field values that violate rule
- Whether data or rule is incorrect

### Record Not Updating

```
Symptom: "Field values don't change after save"
Object: Opportunity
Records: [IDs of opportunities]
```

**Expected Findings**:
- Workflow field updates
- Process Builder actions
- Flow automation
- Whether automation is overriding user input

### Permission Denied

```
Symptom: "User cannot see or edit records"
Object: Custom_Object__c
Records: [Example records]
```

**Expected Findings**:
- Object permissions
- Field-level security
- Sharing rules
- Profile/permission set configuration

## Tips for Success

### ✅ Do's

1. **Start with Sandbox**
   - Test extension with non-production data
   - Verify investigations work as expected
   - Move to production only when comfortable

2. **Be Specific**
   - Clear symptom descriptions help AI generate better plans
   - Include error messages if available
   - Specify which users/profiles are affected

3. **Provide Good Examples**
   - 3-5 records minimum
   - Records that consistently show the issue
   - Records from different users if applicable

4. **Review Plans**
   - Always review before approving
   - Understand what queries will run
   - Cancel if anything looks wrong

5. **Share Reports Appropriately**
   - BU.md for management
   - Tech.md for technical teams
   - Client.md for end users

### ❌ Don'ts

1. **Don't Skip Production Confirmations**
   - HQ2Prod warnings are there for safety
   - Read and understand before proceeding

2. **Don't Share API Keys**
   - Keep Anthropic API key private
   - Don't commit to version control
   - Rotate if exposed

3. **Don't Investigate Without Context**
   - Need symptom, object, and examples
   - Vague requests produce poor results

4. **Don't Ignore Low Confidence**
   - Review findings manually
   - May need more specific investigation
   - Consult with experts

5. **Don't Modify Safety Guards**
   - Guards protect your org
   - Bypassing creates security risks

## Keyboard Shortcuts

None by default, but you can add your own:

1. **File → Preferences → Keyboard Shortcuts**
2. Search for "SF Debug"
3. Assign shortcuts to commands

**Suggested**:
- `Cmd+Shift+I` → Start New Investigation
- `Cmd+Shift+A` → Approve Plan
- `Cmd+Shift+R` → Generate Reports

## Where Things Are

### Investigation Artifacts

```
runtime/
├── agent_workspace/
│   ├── logs/          ← CLI command outputs
│   ├── findings/      ← Analysis results (JSON)
│   ├── plans/         ← Investigation plans
│   ├── web/           ← Web research (if triggered)
│   └── md/            ← Retrieved metadata (quarantined)
├── Reports/           ← Final report bundles
│   └── YYYY-MM-DD-topic/
│       ├── BU.md
│       ├── Tech Document.md
│       └── Client.md
└── scripts/           ← Generated SOQL/Apex
    ├── soql/
    └── apex/
```

### Clean Up Old Investigations

```bash
# Remove old logs (saves space)
rm -rf runtime/agent_workspace/logs/*

# Archive old reports
mv runtime/Reports/ archived-reports-$(date +%Y%m%d)/

# Fresh start
rm -rf runtime/
./setup.sh  # Recreates directories
```

## Common Workflows

### Debug Workflow Issue

1. Start Investigation
2. Provide workflow/flow name in symptom
3. Include records affected by workflow
4. Review retrieved metadata in findings
5. Check Tech Document for automation analysis

### Check User Permissions

1. Start Investigation
2. Symptom: "User cannot access [object]"
3. Include user's profile in impacted users
4. Plan will query permissions
5. Client report shows what to fix

### Validate Data Quality

1. Start Investigation
2. Describe validation rule or constraint
3. Include records that fail validation
4. Findings show which fields violate rules
5. Client report shows correct values

## Getting Help

### Extension Issues
- Check [troubleshooting.md](./docs/troubleshooting.md)
- Review logs in `runtime/agent_workspace/logs/`
- File issue on GitHub with logs

### Salesforce Issues
- Verify CLI authentication
- Check user permissions
- Try queries manually
- Consult Salesforce documentation

### AI Issues
- Verify API key configured
- Check Anthropic service status
- Try simpler investigation
- Review AI responses in logs

## Next Steps

Now that you're set up:

1. **Run Test Investigation**
   - Use a sandbox org
   - Pick a simple, known issue
   - Verify reports look good

2. **Read Documentation**
   - [AGENTS.md](./docs/AGENTS.md) - How it works
   - [security.md](./docs/security.md) - Safety features
   - [troubleshooting.md](./docs/troubleshooting.md) - Common issues

3. **Customize**
   - Adjust settings in VS Code preferences
   - Create keyboard shortcuts
   - Add to your workflow

4. **Share Feedback**
   - What works well?
   - What could be better?
   - Any bugs or issues?

## Support

- **Documentation**: `docs/` folder
- **Issues**: GitHub Issues
- **Security**: See [security.md](./docs/security.md)
- **Community**: Stack Overflow (tag: `salesforce-debugging-agent`)

---

**You're all set! Happy investigating! 🔍**
