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
- Requires VS Code 1.85.0 or higher
- Requires Salesforce CLI for org operations
- Requires Anthropic API key for AI features
- Tested with Claude Sonnet 4 model

## [Unreleased]

### Planned
- Investigation history and search
- Custom report templates
- Multi-org comparison
- Automated regression testing
- Integration with Salesforce DevOps Center
- VS Code Marketplace publication

---

**Legend**:
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements
