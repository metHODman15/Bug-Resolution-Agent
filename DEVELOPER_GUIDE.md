# Developer Onboarding Guide

Welcome! This guide will help you understand how to work with the Salesforce Debug Agent extension as a developer.

## 🎯 What You Can Access

### ✅ Full Access (Modifiable)

**Extension Configuration**:
- `package.json` - Add commands, settings, contribution points
- `tsconfig.json` - Adjust TypeScript compilation
- `.eslintrc.json` - Modify linting rules
- `.vscode/*` - Workspace settings

**TypeScript Source** (`extension/src/`):
- `extension.ts` - Entry point and command registration
- `commands/*` - User-facing command implementations
- `agent/state.ts` - State management (modify carefully)
- `agent/safety/*` - Safety guards (⚠️ changes affect security)
- `agent/execution/*` - CLI execution logic
- `agent/analysis/*` - Result analysis
- `agent/reporting/*` - Report generation

**Templates** (`agent_templates/`):
- Report templates (BU, Tech, Client)
- SOQL query templates
- Investigation plan templates

**Documentation**:
- All markdown files
- Comments in code

### 🔒 Hidden/Non-Modifiable (By Design)

**Agent Instructions** (`extension/src/agent/instructions.ts`):
- `SYSTEM_INSTRUCTIONS`: Controls planning behavior (read-only operations, safety)
- `ANALYSIS_INSTRUCTIONS`: Controls analysis and root cause determination
- `REPORT_INSTRUCTIONS`: Controls report generation formatting
- **These are embedded constants that cannot be modified by end users**

**Why Hidden?**:
- Ensures consistent agent behavior across all investigations
- Prevents accidental misuse or security compromises
- Maintains predictable outcomes for compliance
- Provides stable AI behavior regardless of user configuration

**Developer Access**: 
- You can modify these in source code for updates
- They are compiled into the extension binary
- Not accessible through VS Code settings, UI, or runtime files
- Users cannot view or edit them through any extension interface

**Security Note**: Changes to instructions affect the fundamental behavior of the agent. Test thoroughly before deployment.

---

## 🎨 Making UI Changes

The extension uses **input boxes** and **webviews** for UI. Here's how to modify them:

### Adding a New Input Field

**Location**: `extension/src/commands/startInvestigation.ts`

**Example**: Add "Priority" field to investigation context

#### Step 1: Update the Command

```typescript
// In startInvestigation.ts, after existing inputs

const priority = await vscode.window.showQuickPick(
    ['High', 'Medium', 'Low'],
    {
        placeHolder: 'Select investigation priority',
        ignoreFocusOut: true
    }
);

if (!priority) {
    return; // User cancelled
}
```

#### Step 2: Update Context Interface

```typescript
// In extension/src/agent/state.ts

export interface InvestigationContext {
    orgAlias: string;
    symptom: string;
    impactedObject: string;
    impactedUsers: string;
    exampleRecords: string[];
    timestamp: string;
    investigationId: string;
    priority?: 'High' | 'Medium' | 'Low'; // Add this
}
```

#### Step 3: Pass to Context

```typescript
// Back in startInvestigation.ts, in investigationContext object

const investigationContext: InvestigationContext = {
    orgAlias,
    symptom,
    impactedObject,
    impactedUsers: impactedUsers || 'Not specified',
    exampleRecords,
    timestamp: new Date().toISOString(),
    investigationId: generateInvestigationId(),
    priority // Add this
};
```

#### Step 4: Update Reports to Show Priority

```typescript
// In extension/src/agent/reporting/buWriter.ts

report += `**Priority:** ${plan.context.priority || 'Not specified'}\n\n`;
```

#### Step 5: Test

1. Press F5 to launch extension
2. Start new investigation
3. Verify new field appears
4. Check it shows in reports

### Modifying the Webview (Plan Display)

**Location**: `extension/src/commands/startInvestigation.ts` → `generatePlanHtml()`

#### Example: Add Visual Indicators for Step Types

```typescript
function generatePlanHtml(plan: any): string {
    const steps = plan.steps.map((step: any, index: number) => {
        // Add icon based on step type
        const icon = getStepIcon(step.type);
        
        return `
        <div class="step">
            <h3>${icon} Step ${index + 1}: ${step.description}</h3>
            <p><strong>Type:</strong> ${step.type}</p>
            ${step.command ? `<p><strong>Command:</strong> <code>${escapeHtml(step.command)}</code></p>` : ''}
            <p><strong>Status:</strong> <span class="status-${step.status}">${step.status}</span></p>
        </div>
    `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        /* Add new styles */
        .status-pending { color: orange; }
        .status-running { color: blue; }
        .status-completed { color: green; }
        .status-failed { color: red; }
        /* ... existing styles ... */
    </style>
</head>
<body>
    ${/* ... existing content ... */}
</body>
</html>`;
}

function getStepIcon(type: string): string {
    const icons: Record<string, string> = {
        'query': '🔍',
        'retrieve': '📦',
        'apex': '⚡',
        'analysis': '🧠'
    };
    return icons[type] || '📋';
}
```

### Adding a New Command

#### Step 1: Register in package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "sfDebug.viewHistory",
        "title": "View Investigation History",
        "category": "SF Debug"
      }
    ]
  }
}
```

#### Step 2: Create Command File

```typescript
// extension/src/commands/viewHistory.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export async function viewHistoryCommand(
    context: vscode.ExtensionContext
): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const reportsDir = path.join(workspaceRoot, 'runtime', 'Reports');
    
    if (!fs.existsSync(reportsDir)) {
        vscode.window.showInformationMessage('No investigations found');
        return;
    }

    const investigations = fs.readdirSync(reportsDir)
        .filter(name => fs.statSync(path.join(reportsDir, name)).isDirectory())
        .map(name => ({
            label: name,
            description: 'View this investigation',
            path: path.join(reportsDir, name)
        }));

    if (investigations.length === 0) {
        vscode.window.showInformationMessage('No investigations found');
        return;
    }

    const selected = await vscode.window.showQuickPick(investigations, {
        placeHolder: 'Select investigation to view'
    });

    if (selected) {
        const buPath = vscode.Uri.file(path.join(selected.path, 'BU.md'));
        await vscode.commands.executeCommand('vscode.open', buPath);
    }
}
```

#### Step 3: Register in extension.ts

```typescript
// extension/src/extension.ts

import { viewHistoryCommand } from './commands/viewHistory';

export async function activate(context: vscode.ExtensionContext) {
    // ... existing registrations ...
    
    context.subscriptions.push(
        vscode.commands.registerCommand('sfDebug.viewHistory', () => 
            viewHistoryCommand(context)
        )
    );
}
```

#### Step 4: Test

1. Recompile: `npm run compile`
2. Press F5
3. Command Palette → "SF Debug: View Investigation History"

---

## 🔒 Modifying Safety Guards

### ⚠️ Important Warning

Modifying safety guards changes security posture. Only do this if:
- You fully understand the implications
- You have a specific, justified use case
- You've tested thoroughly
- You've documented the changes

### Example: Adding Allowed Command

**Scenario**: Allow `sf org display` command for debugging

#### Step 1: Update Allowlist

```typescript
// extension/src/agent/safety/cliAllowlist.ts

export class CliAllowlist {
    private static readonly ALLOWED_COMMANDS = [
        'sf data query',
        'sf apex run',
        'sf project retrieve start',
        'sf org display' // Add this
    ];
    
    // ... rest of class ...
    
    static isCommandAllowed(command: string): boolean {
        const normalizedCmd = command.trim().toLowerCase();
        
        // ... existing checks ...
        
        // Add validation for new command
        if (normalizedCmd.startsWith('sf org display')) {
            return this.validateOrgDisplayCommand(normalizedCmd);
        }
        
        return false;
    }
    
    private static validateOrgDisplayCommand(command: string): boolean {
        // Must include org alias or --target-org
        return command.includes('-o ') || 
               command.includes('--target-org');
    }
}
```

#### Step 2: Document the Change

```typescript
/**
 * CLI Allowlist - Only permits read-only Salesforce CLI commands
 * 
 * MODIFICATIONS:
 * - 2026-01-22: Added sf org display for debugging (read-only, shows org info)
 */
```

#### Step 3: Test Thoroughly

Create test cases:
```typescript
// Test the new command
const testCases = [
    { cmd: 'sf org display -o myOrg', expected: true },
    { cmd: 'sf org display --target-org myOrg', expected: true },
    { cmd: 'sf org display', expected: false }, // no org specified
    { cmd: 'sf org delete', expected: false }   // similar but dangerous
];
```

#### Step 4: Update Documentation

Add to [docs/security.md](docs/security.md):
```markdown
### Allowed Commands (Updated 2026-01-22)

- `sf data query --file <path> --json`
- `sf apex run --file <path>`
- `sf project retrieve start ...`
- `sf org display -o <org>` ← NEW: Read-only org information
```

---

## 🧪 Testing Your Changes

### Manual Testing Checklist

**Before Committing**:

- [ ] Extension compiles without errors
- [ ] No ESLint warnings
- [ ] Changes tested in Extension Development Host
- [ ] All existing commands still work
- [ ] New features work as expected
- [ ] Reports generate correctly
- [ ] Safety guards still enforce restrictions
- [ ] Documentation updated

### Test in Extension Development Host

1. **Launch**: Press F5
2. **Set Breakpoints**: In your modified files
3. **Test Command**: Run the command you changed
4. **Check Output**: Verify behavior is correct
5. **Check Logs**: Look in `runtime/agent_workspace/logs/`
6. **Check Reports**: Verify format and content

### Common Test Scenarios

#### Test Investigation Flow

```
1. Start Investigation
2. Fill in all fields
3. Review plan
4. Approve plan
5. Run queries
6. Generate reports
7. Verify all 3 reports created
8. Check logs for errors
```

#### Test Safety Guards

```
1. Try to modify allowlist to include 'sf project deploy'
2. Verify it's still blocked (shouldn't work)
3. Try Apex with DML
4. Verify it's blocked
5. Try to write to 'src/' directory
6. Verify it's blocked
```

#### Test Error Handling

```
1. Start investigation with invalid org
2. Verify error message is clear
3. Start investigation without API key
4. Verify prompt to configure
5. Approve plan with network issues
6. Verify graceful failure
```

---

## 📝 Code Style Guidelines

### TypeScript Conventions

```typescript
// Use interfaces for data structures
export interface InvestigationContext {
    // ... properties
}

// Use classes for stateful objects
export class InvestigationState {
    // ... methods
}

// Use async/await for promises
async function executeStep(step: PlanStep): Promise<string> {
    // ... implementation
}

// Use descriptive variable names
const investigationContext = {...};  // Good
const ctx = {...};  // Avoid

// Document public methods
/**
 * Validates if a command is allowed by the allowlist
 * @param command The full command string to validate
 * @returns true if command is allowed, false otherwise
 */
static isCommandAllowed(command: string): boolean {
    // ... implementation
}
```

### File Organization

```
extension/src/
├── extension.ts           # Keep minimal, just registration
├── commands/              # One file per command
│   └── commandName.ts
├── agent/
│   ├── state.ts           # State management only
│   ├── planner.ts         # Planning logic only
│   ├── safety/            # Each guard in separate file
│   ├── execution/         # Execution logic
│   ├── analysis/          # Analysis logic
│   └── reporting/         # One writer per report type
└── schemas/               # JSON schemas for validation
```

### Error Handling

```typescript
// Always catch and handle errors
try {
    const result = await riskyOperation();
    return result;
} catch (error) {
    // Provide context
    const message = error instanceof Error 
        ? error.message 
        : 'Unknown error';
    
    // Show user-friendly message
    vscode.window.showErrorMessage(
        `Operation failed: ${message}`
    );
    
    // Log for debugging
    console.error('Detailed error:', error);
    
    // Rethrow if needed
    throw error;
}
```

---

## 🔧 Advanced Customization

### Adding New Report Type

**Example**: Executive Summary Report

#### Step 1: Create Writer

```typescript
// extension/src/agent/reporting/executiveWriter.ts

export class ExecutiveWriter {
    async writeReport(
        reportDir: string,
        plan: InvestigationPlan,
        findings: Finding[],
        rootCause: RootCauseAnalysis
    ): Promise<void> {
        const content = this.generateExecutiveReport(plan, rootCause);
        const filePath = path.join(reportDir, 'Executive.md');
        fs.writeFileSync(filePath, content, 'utf8');
    }

    private generateExecutiveReport(
        plan: InvestigationPlan,
        rootCause: RootCauseAnalysis
    ): string {
        // One-page executive summary
        return `# Executive Summary
        
**Issue**: ${plan.context.symptom}

**Root Cause**: ${rootCause.primaryCause}

**Confidence**: ${rootCause.confidence}

**Recommendation**: ${rootCause.recommendedActions[0]}

**Impact**: ${rootCause.affectedRecords.length} records

---
*For details, see Technical Document*`;
    }
}
```

#### Step 2: Update Generate Reports Command

```typescript
// extension/src/commands/generateReports.ts

import { ExecutiveWriter } from '../agent/reporting/executiveWriter';

export async function generateReportsCommand(...) {
    // ... existing code ...
    
    progress.report({ message: 'Writing executive summary...', increment: 20 });
    const execWriter = new ExecutiveWriter();
    await execWriter.writeReport(reportDir, plan, findings, rootCause);
    
    // ... open all reports including Executive.md
}
```

### Adding Configuration Settings

#### Step 1: Update package.json

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "sfDebug.includeExecutiveSummary": {
          "type": "boolean",
          "default": true,
          "description": "Include executive summary in report bundle"
        }
      }
    }
  }
}
```

#### Step 2: Use in Code

```typescript
const config = vscode.workspace.getConfiguration('sfDebug');
const includeExecutive = config.get<boolean>('includeExecutiveSummary', true);

if (includeExecutive) {
    await execWriter.writeReport(...);
}
```

---

## 🐛 Debugging Tips

### VS Code Developer Tools

1. **Open**: Help → Toggle Developer Tools
2. **Console Tab**: See extension logs
3. **Network Tab**: See API requests (if any)
4. **Sources Tab**: Set breakpoints in compiled JS

### Logging Best Practices

```typescript
// Use console methods appropriately
console.log('Info: Starting investigation');     // General info
console.warn('Warning: Retry attempt 2 of 2');   // Warnings
console.error('Error: Failed to execute', err);  // Errors

// Include context
console.log(`[${step.id}] Executing: ${step.command}`);

// Log to file for important operations
await this.logOutput('query', step.id, stdout, stderr);
```

### Common Issues

**Extension Not Activating**:
- Check activation events in package.json
- Look for compile errors
- Check extension host log

**Commands Not Showing**:
- Verify registration in extension.ts
- Check command ID matches package.json
- Reload window (Developer → Reload Window)

**Webview Not Displaying**:
- Check HTML syntax
- Verify CSS variable names
- Test with simple HTML first

---

## 📚 Learning Resources

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### VS Code Extension API
- [Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)

### Salesforce CLI
- [CLI Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/)
- [CLI Plugin Development](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_cli_plugins.htm)

### Anthropic Claude
- [API Documentation](https://docs.anthropic.com/)
- [Claude Console](https://console.anthropic.com/)

---

## 🤝 Getting Help

### During Development

1. **Read This Guide**: Most questions answered here
2. **Check Examples**: Look at existing commands
3. **Use Debugger**: Set breakpoints and inspect
4. **Review Logs**: Check console and file logs
5. **Ask Team**: Other developers on the project

### Stuck on Something?

**Good Question**:
> "I'm trying to add a new field to InvestigationContext. I updated the interface in state.ts and added the input in startInvestigation.ts, but it's not showing in the report. Where should I modify the report generation?"

**Answer**: Update the appropriate writer in `extension/src/agent/reporting/`, e.g., `buWriter.ts`.

**Better Question** (includes what you've tried):
> "I added a priority field to InvestigationContext and updated buWriter.ts to display it, but I'm getting a TypeScript error: 'Property priority does not exist on type InvestigationContext'. The interface shows it as optional. Am I accessing it correctly?"

**Answer**: Use optional chaining: `plan.context.priority?.toString() || 'Not specified'`

---

## ✅ Pre-Commit Checklist

Before committing changes:

- [ ] Code compiles without errors
- [ ] No ESLint warnings
- [ ] Added/updated tests (if applicable)
- [ ] Updated documentation (README, docs/, comments)
- [ ] Tested in Extension Development Host
- [ ] Verified safety guards still work
- [ ] Checked for sensitive data in logs
- [ ] Updated CHANGELOG.md
- [ ] Committed with descriptive message

### Good Commit Messages

```
✅ feat: Add priority field to investigation context

- Added priority input in startInvestigation command
- Updated InvestigationContext interface
- Added priority display to BU report
- Updated schema and documentation

❌ updated stuff

❌ changes

✅ fix: Correct webview CSS for dark theme

- Fixed contrast issues with status colors
- Updated CSS variables to use theme colors
- Tested in light and dark themes
```

---

## 🎓 Next Steps

Now that you're onboarded:

1. **Make a Small Change**: Add a new input field
2. **Test It**: Verify it works end-to-end
3. **Review Safety**: Ensure guards still protect
4. **Document It**: Update relevant docs
5. **Commit It**: Use good commit message

You're ready to contribute! 🚀

---

**Questions?** Check [docs/troubleshooting.md](docs/troubleshooting.md) or ask the team!
