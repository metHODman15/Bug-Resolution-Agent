# Security Documentation

## Overview

The Salesforce Debug Agent implements multiple layers of security to ensure safe, read-only operations against Salesforce orgs. This document details all security measures and their implementation.

## Security Principles

### 1. Read-Only by Design
- **No deployment capabilities**: Extension cannot deploy or push changes
- **No DML operations**: All Apex code is scanned and blocked if DML detected
- **No data modification**: Only query and retrieve operations allowed
- **Quarantined metadata**: Retrieved metadata isolated from deployable source

### 2. Defense in Depth
Multiple overlapping security layers:
- Command allowlist (CLI level)
- Code scanning (Apex level)
- Path restrictions (File system level)
- Production safeguards (Org level)

### 3. Least Privilege
- Minimal required permissions
- No elevated access needed
- User's Salesforce permissions apply
- No bypass mechanisms

### 4. Audit Trail
- All operations logged
- Timestamped execution records
- Production operations specially marked
- Investigation artifacts preserved

## Security Layers

### Layer 1: CLI Allowlist

**File**: `extension/src/agent/safety/cliAllowlist.ts`

**Purpose**: Ensures only approved read-only Salesforce CLI commands execute

**Allowed Commands**:
- `sf data query --file <path> --json`
- `sf apex run --file <path>`
- `sf project retrieve start ...`

**Blocked Commands**:
- `sf project deploy` - Prevents deployment
- `sf data delete` - Prevents data deletion
- `sf data update` - Prevents data modification
- Any command with: deploy, push, delete, create, update, insert, upsert, undelete

**Validation**:
```typescript
CliAllowlist.isCommandAllowed(command: string): boolean
```

**Rejection Handling**:
- Returns clear reason for rejection
- Logs blocked attempts
- Prevents execution entirely

### Layer 2: DML Scanner

**File**: `extension/src/agent/safety/dmlScanner.ts`

**Purpose**: Detects and blocks Data Manipulation Language in Apex code

**Detected Patterns**:
- Direct DML: `insert`, `update`, `delete`, `upsert`, `undelete`, `merge`
- Database methods: `Database.insert()`, `Database.update()`, etc.
- HTTP callouts: `HttpRequest`, `Http.send()`, `Messaging.sendEmail()`

**Scanning Process**:
1. Normalize code (remove comments, strings)
2. Convert to lowercase
3. Pattern match against DML keywords
4. Generate violation report

**False Positive Mitigation**:
- Comments removed before scanning
- String literals excluded
- Context-aware pattern matching

### Layer 3: Path Guard

**File**: `extension/src/agent/safety/pathGuard.ts`

**Purpose**: Restricts file system operations to safe directories

**Allowed Write Directories**:
- `runtime/scripts/` - Generated SOQL/Apex
- `runtime/agent_workspace/` - Investigation artifacts
- `runtime/Reports/` - Generated reports

**Forbidden Write Directories**:
- `force-app/` - Salesforce source
- `src/` - Extension source
- `extension/` - Extension code
- `agent_templates/` - Templates
- `node_modules/` - Dependencies
- `.sfdx/`, `.sf/`, `.git/` - System directories

**Protection Against**:
- Path traversal (`../../../etc/passwd`)
- Absolute path writes outside workspace
- Overwrites of source code
- Sensitive file access (`.env`, `*.key`, `*.pem`)

**Validation**:
```typescript
PathGuard.isWriteAllowed(path: string, workspace: string): boolean
PathGuard.isReadAllowed(path: string, workspace: string): boolean
```

### Layer 4: HQ2Prod Guard

**File**: `extension/src/agent/safety/hq2prodGuard.ts`

**Purpose**: Special protection for production Salesforce orgs

**Production Org Detection**:
- Exact match: `HQ2Prod`
- Contains: `prod`, `production`

**Additional Safeguards**:
1. **Confirmation Dialog**
   - Modal warning before any operation
   - Requires explicit "I Understand - Proceed"
   - Details read-only nature and logging

2. **Enhanced Logging**
   - All production operations logged
   - User, timestamp, org alias recorded
   - Audit trail maintained

3. **Visual Warnings**
   - Status bar messages during execution
   - "⚠️ PRODUCTION" prefix on commands
   - 5-second status bar notification

4. **Write Operation Blocks**
   - Double-checks for write keywords
   - Blocks even if other guards missed
   - Error message with org name

**Validation**:
```typescript
HQ2ProdGuard.confirmProductionAccess(orgAlias: string): Promise<boolean>
HQ2ProdGuard.validateProductionOperation(orgAlias, operation, details): Promise<boolean>
```

## API Key Security

### Storage

**Implementation**: VS Code Secret Storage API

```typescript
// Store (encrypted by VS Code)
await context.secrets.store('anthropic-api-key', apiKey);

// Retrieve
const apiKey = await context.secrets.get('anthropic-api-key');
```

**Security Features**:
- Platform-specific encryption (Keychain/Credential Manager/Secret Service)
- Never stored in plaintext
- Never logged or exposed in UI
- Not included in error messages
- Cleared on extension uninstall (optional)

### Validation

**Format Check**: Must start with `sk-ant-`

**Input Handling**:
- Password-masked input box
- Not echoed in terminal
- Not stored in workspace settings
- Not committed to git

### Usage

**Transmission**: HTTPS only to Anthropic API

**Scope**: Only used for AI operations:
- Plan generation
- Result analysis
- Root cause determination

**Not Used For**:
- Authentication to Salesforce
- Extension licensing
- Telemetry
- Third-party services

## Data Privacy

### Investigation Data

**Storage Location**: `runtime/` directory (gitignored)

**Data Types**:
- SOQL query results (may contain customer data)
- Metadata (configuration, no customer data)
- Analysis findings (derived insights)
- Reports (summary information)

**Data Handling**:
- Stored locally only
- Not transmitted except to Anthropic for analysis
- User responsible for sharing reports
- Can be deleted by removing `runtime/` directory

### Anthropic API

**Data Sent**:
- Investigation context (symptom, object, records)
- Query results (for analysis)
- Metadata (for interpretation)

**Data NOT Sent**:
- API keys
- Credentials
- Unrelated workspace files
- Full org schema

**Data Retention**: Per Anthropic's data retention policy

**User Control**: Users must configure API key (opt-in)

## Salesforce Org Security

### Authentication

**Method**: Relies on Salesforce CLI authentication

**Extension Does NOT**:
- Store Salesforce credentials
- Handle username/password
- Manage OAuth tokens
- Bypass authentication

**User Responsibility**:
- Authenticate via `sf org login`
- Manage org aliases
- Ensure appropriate user permissions

### Permissions Required

**Minimum Salesforce User Permissions**:
- API Enabled
- View Setup and Configuration (for metadata)
- Read access to investigated objects

**No Special Permissions Needed**:
- Modify All Data - NOT required
- Modify Metadata - NOT required
- View All Data - Helpful but not required

### Org Data Access

**Read Operations**:
- SOQL queries (within user's sharing rules)
- Metadata retrieval (within user's permissions)
- Apex describe operations

**Respects Salesforce Security**:
- Object-level security
- Field-level security
- Sharing rules
- Record-level security

## Threat Model

### Threats Mitigated

1. **Accidental Deployment**
   - Mitigation: No deploy commands in allowlist
   - Impact: Cannot deploy changes

2. **Data Modification**
   - Mitigation: DML scanner blocks all DML
   - Impact: Cannot modify records

3. **Malicious Code Execution**
   - Mitigation: Allowlist + DML scanner + path guard
   - Impact: Cannot execute arbitrary code

4. **Source Code Corruption**
   - Mitigation: Path guard blocks writes to source
   - Impact: Cannot overwrite extension or app source

5. **Production Incidents**
   - Mitigation: HQ2Prod guard + confirmation
   - Impact: Extra protection for production orgs

6. **Credential Exposure**
   - Mitigation: Secret storage + no logging
   - Impact: API keys protected

### Residual Risks

1. **User-Initiated Unsafe Actions**
   - User can manually run dangerous commands outside extension
   - Mitigation: Education, documentation
   - Responsibility: User

2. **Salesforce CLI Bugs**
   - Underlying CLI may have vulnerabilities
   - Mitigation: Keep CLI updated
   - Responsibility: Salesforce

3. **AI Hallucination**
   - AI may provide incorrect analysis
   - Mitigation: Confidence levels, human review
   - Responsibility: User validation

4. **Malicious AI Prompts**
   - If AI generates dangerous commands
   - Mitigation: Multiple validation layers
   - Impact: Commands still blocked by guards

## Security Best Practices

### For Developers

1. **Never bypass safety guards**
   - Guards are non-negotiable
   - Adding bypass = security violation

2. **Validate all inputs**
   - User input must be sanitized
   - Path traversal checks mandatory

3. **Log security events**
   - Failed guard checks
   - Blocked commands
   - Production operations

4. **Review AI outputs**
   - Don't trust AI-generated commands
   - Always validate through guards

### For Users

1. **Protect your API key**
   - Don't share screenshots
   - Don't commit to version control
   - Rotate if exposed

2. **Review plans before approval**
   - Understand what will execute
   - Cancel if uncertain

3. **Limit production access**
   - Use sandbox for testing
   - Production only when necessary

4. **Review generated reports**
   - May contain sensitive data
   - Share appropriately

## Compliance Considerations

### Data Residency

**Data Locations**:
- Local: Investigation artifacts in workspace
- US: Anthropic API (for AI analysis)

**Compliance Impact**:
- GDPR: User data may be sent to US
- CCPA: California user data may be processed
- Responsibility: User must evaluate for their use case

### Audit Requirements

**Audit Trail Components**:
- Investigation logs (all operations)
- Production operation logs (timestamped)
- Command execution logs (stdout/stderr)
- Finding timestamps

**Log Retention**: User-controlled (in `runtime/`)

**Log Access**: Local file system only

## Incident Response

### Security Incident Types

1. **Guard Bypass Detected**
   - Action: Review logs, patch guard
   - Escalation: Immediate

2. **API Key Exposure**
   - Action: User rotates key
   - Extension: No action needed

3. **Unauthorized Deployment**
   - Action: Review investigation logs
   - Escalation: User's Salesforce admin

4. **Data Breach**
   - Action: Review what data was accessed
   - Escalation: User's security team

### Reporting Security Issues

**Contact**: Repository maintainers

**Include**:
- Steps to reproduce
- Expected vs actual behavior
- Impact assessment
- Suggested fix (if any)

**Response Time**: Best effort, no SLA

## Security Updates

### Maintenance Schedule

**Regular**:
- Dependency updates (monthly)
- Security advisories (as needed)
- Guard improvements (as needed)

**Emergency**:
- Critical vulnerabilities (immediate)
- Bypass discovered (immediate)

### User Notifications

**Update Channels**:
- VS Code extension updates
- GitHub releases
- README changelog

**User Actions**:
- Update extension when prompted
- Review release notes
- Test in sandbox first

## Conclusion

The Salesforce Debug Agent implements defense-in-depth security to ensure safe, read-only operations. Multiple overlapping layers protect against accidental or malicious modification of Salesforce data and configuration. Users must still exercise appropriate caution and follow security best practices when investigating production orgs.
