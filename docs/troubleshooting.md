# Troubleshooting Guide

## Installation Issues

### Extension Won't Activate

**Symptom**: Extension doesn't appear in command palette or shows as disabled

**Possible Causes**:
1. VS Code version too old
2. TypeScript compilation failed
3. Missing dependencies

**Solutions**:
1. Check VS Code version: Help → About (need 1.85.0+)
2. Recompile extension:
   ```bash
   npm install
   npm run compile
   ```
3. Check for compilation errors in Problems panel
4. Reload VS Code: Developer → Reload Window

### Dependencies Won't Install

**Symptom**: `npm install` fails with errors

**Possible Causes**:
1. Node.js version incompatible
2. Network issues
3. Corrupted package-lock.json

**Solutions**:
1. Check Node.js version (need v16+):
   ```bash
   node --version
   ```
2. Clear npm cache:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Use npm registry mirror if network issues

## API Key Issues

### API Key Not Accepted

**Symptom**: "Invalid Anthropic API key format" error

**Solutions**:
1. Verify key starts with `sk-ant-`
2. Copy key carefully (no extra spaces)
3. Get new key from Anthropic dashboard
4. Try storing again: `SF Debug: Configure Anthropic API Key`

### API Key Not Found

**Symptom**: "Anthropic API key not configured" when starting investigation

**Solutions**:
1. Run: `SF Debug: Configure Anthropic API Key`
2. Check VS Code can access secret storage:
   - macOS: Keychain access enabled
   - Windows: Credential Manager accessible
   - Linux: Secret Service available
3. Try reloading VS Code after configuring

### API Calls Failing

**Symptom**: Plan generation or analysis fails with API errors

**Possible Causes**:
1. Invalid API key
2. Rate limiting
3. Network connectivity
4. Anthropic service issues

**Solutions**:
1. Verify API key is valid (try in Anthropic console)
2. Wait and retry if rate limited
3. Check network: `curl https://api.anthropic.com`
4. Check Anthropic status page

## Salesforce CLI Issues

### CLI Not Found

**Symptom**: `sf: command not found` error

**Solutions**:
1. Install Salesforce CLI:
   ```bash
   npm install -g @salesforce/cli
   ```
2. Verify installation:
   ```bash
   sf --version
   ```
3. Restart terminal/VS Code after install
4. Check PATH includes CLI location

### Org Not Authenticated

**Symptom**: "No authorization found" when running queries

**Solutions**:
1. List authenticated orgs:
   ```bash
   sf org list
   ```
2. Login to org:
   ```bash
   sf org login web -a myOrgAlias
   ```
3. Verify org alias matches investigation input
4. Set default org if needed:
   ```bash
   sf config set target-org myOrgAlias
   ```

### Query Permissions Error

**Symptom**: "Insufficient privileges" or "No such object" errors

**Possible Causes**:
1. User lacks object access
2. User lacks API permission
3. User lacks field-level security

**Solutions**:
1. Verify Salesforce user has:
   - API Enabled permission
   - Read access to investigated objects
   - View Setup and Configuration (for metadata)
2. Check object and field permissions in Salesforce
3. Use user with broader permissions
4. Contact Salesforce admin for access

## Investigation Issues

### Plan Generation Fails

**Symptom**: "Failed to create investigation plan" error

**Possible Causes**:
1. API key issues
2. Invalid investigation context
3. AI service timeout

**Solutions**:
1. Check API key is configured
2. Verify all required fields filled:
   - Org alias (not empty)
   - Symptom (descriptive)
   - Object/feature (valid)
   - Example records (1-10)
3. Try simpler symptom description
4. Retry with better network connection

### Plan Approval Fails

**Symptom**: Can't approve plan or approval doesn't take effect

**Solutions**:
1. Verify plan is displayed in webview
2. Close and reopen plan view
3. Restart investigation if needed
4. Check for errors in Developer Console (Help → Toggle Developer Tools)

### Query Execution Fails

**Symptom**: Steps fail during "Run Queries" phase

**Possible Causes**:
1. CLI command blocked by safety guards
2. SOQL syntax error
3. Org connectivity issue
4. DML detected in Apex

**Solutions**:

**If command blocked**:
- Review error message for specific guard
- Verify command is read-only
- Check `runtime/agent_workspace/logs/` for details

**If SOQL error**:
- Review generated SOQL in `runtime/scripts/soql/`
- Verify object API names correct
- Check field permissions

**If DML detected**:
- Review Apex script in `runtime/scripts/apex/`
- Ensure no insert/update/delete operations
- Verify no Database.* DML methods
- Check for false positives (contact support if needed)

**If connectivity issue**:
- Check org authentication
- Verify network connection
- Try CLI command manually

### Analysis Produces No Findings

**Symptom**: Steps complete but no findings generated

**Possible Causes**:
1. AI couldn't parse CLI output
2. Empty query results
3. Analysis timeout

**Solutions**:
1. Check `runtime/agent_workspace/logs/` for raw output
2. Verify example records exist in org
3. Try with records you know exist
4. Check for API errors in logs

### Root Cause Has Low Confidence

**Symptom**: Root cause shows "low" confidence level

**This is Normal When**:
- Investigation is complex
- Multiple possible causes
- Insufficient evidence
- Conflicting findings

**To Improve**:
1. Provide more example records
2. Be more specific in symptom description
3. Manually review findings in `runtime/agent_workspace/findings/`
4. Consider running a more targeted investigation

## Report Generation Issues

### Reports Won't Generate

**Symptom**: "Failed to generate reports" error

**Possible Causes**:
1. Investigation not completed
2. Missing root cause analysis
3. File permission issues

**Solutions**:
1. Ensure investigation completed successfully
2. Check retry count (max 2 attempts)
3. Verify `runtime/` directory writable:
   ```bash
   ls -la runtime/
   chmod 755 runtime/
   ```
4. Check disk space available

### Reports Missing Content

**Symptom**: Reports generated but sections empty

**Possible Causes**:
1. No findings collected
2. Analysis failed
3. Template rendering issue

**Solutions**:
1. Review investigation steps - did they complete?
2. Check `runtime/agent_workspace/findings/` for JSON files
3. Look for errors in Developer Console
4. Re-run investigation with different context

### Reports Won't Open

**Symptom**: Reports generate but don't open in editor

**Solutions**:
1. Manually open from `runtime/Reports/[date]-[topic]/`
2. Check file permissions
3. Try: File → Open File → navigate to report
4. Verify markdown preview available

## Safety Guard Issues

### False Positive: Safe Command Blocked

**Symptom**: Read-only command blocked by CLI allowlist

**Temporary Workaround**:
1. Run command manually via terminal
2. Copy output to `runtime/agent_workspace/logs/`
3. Continue investigation manually

**Report Issue**:
- File bug with command details
- Include use case
- Suggest allowlist addition

### False Positive: Read-Only Apex Blocked

**Symptom**: Describe-only Apex flagged as DML

**Temporary Workaround**:
1. Review Apex in `runtime/scripts/apex/`
2. Manually verify it's read-only
3. Run manually: `sf apex run --file <path>`

**Report Issue**:
- File bug with Apex code
- Explain why it's safe
- Suggest scanner improvement

### Can't Write to Allowed Directory

**Symptom**: Write blocked despite being in `runtime/`

**Solutions**:
1. Check exact path in error message
2. Verify relative to workspace root
3. Create directory manually:
   ```bash
   mkdir -p runtime/agent_workspace/logs
   ```
4. Check file permissions

## Production Org Issues

### HQ2Prod Confirmation Keeps Appearing

**Symptom**: Multiple confirmation dialogs for production org

**This is Intentional**:
- Each major operation requires confirmation
- Ensures explicit consent
- Safety feature, not a bug

**To Reduce**:
- Use sandbox org for testing
- Production only when necessary

### Production Operations Too Slow

**Symptom**: Investigation takes longer on production

**This is Normal**:
- Enhanced logging enabled
- Additional validation steps
- Status bar updates

**Not an Issue**: Safety > Speed for production

## Performance Issues

### Investigation Takes Too Long

**Symptom**: Investigation hangs or times out

**Possible Causes**:
1. Large query results
2. Many metadata components
3. AI analysis timeout
4. Network latency

**Solutions**:
1. Reduce number of example records
2. Be more specific about metadata types
3. Check network connection
4. Try during off-peak hours

### Extension Using Too Much Memory

**Symptom**: VS Code becomes slow or unresponsive

**Solutions**:
1. Close unnecessary files
2. Limit concurrent investigations (1 at a time)
3. Clear `runtime/` directory periodically:
   ```bash
   rm -rf runtime/agent_workspace/logs/*
   ```
4. Restart VS Code

## Data Issues

### Can't Find Example Records

**Symptom**: "No records found" when querying

**Solutions**:
1. Verify record IDs are correct (15 or 18 char)
2. Check records exist in target org
3. Extract ID from URL: `https://.../[ID]/view`
4. Verify user has read access to records

### Query Returns No Data

**Symptom**: Query succeeds but returns empty results

**Possible Causes**:
1. Records don't match query criteria
2. Sharing rules limit access
3. Field-level security hides fields

**Solutions**:
1. Review generated SOQL in `runtime/scripts/soql/`
2. Run SOQL manually in Developer Console
3. Check sharing rules for records
4. Verify FLS for queried fields

### Metadata Not Found

**Symptom**: Metadata retrieve returns empty or fails

**Possible Causes**:
1. Metadata type doesn't exist
2. Wrong object API name
3. No metadata of that type
4. Insufficient permissions

**Solutions**:
1. Verify object API name spelling
2. Check metadata exists:
   ```bash
   sf project retrieve start -m Flow -o myOrg
   ```
3. Use Setup to verify metadata type
4. Check user permissions for metadata access

## Log Analysis

### Where Are Logs?

**Location**: `runtime/agent_workspace/logs/`

**Log Types**:
- `query-[step-id]-[timestamp].log` - SOQL query output
- `apex-[step-id]-[timestamp].log` - Apex execution output
- `retrieve-[step-id]-[timestamp].log` - Metadata retrieve output

**Log Format**:
```
=== [TYPE] OUTPUT ===
Step: [step-id]
Timestamp: [timestamp]
Org: [org-alias]

STDOUT:
[command output]

STDERR:
[errors/warnings]
```

### How to Read Logs

1. **Identify Failed Step**:
   - Look for step status: `failed`
   - Check error message

2. **Find Corresponding Log**:
   - Match step ID: `step-1`, `step-2`, etc.
   - Most recent timestamp

3. **Analyze Output**:
   - STDOUT: command result
   - STDERR: errors/warnings
   - Look for Salesforce error codes

4. **Common Error Patterns**:
   - `INVALID_TYPE`: Wrong object/field name
   - `INSUFFICIENT_ACCESS`: Permission issue
   - `QUERY_TIMEOUT`: Query too complex
   - `MALFORMED_QUERY`: SOQL syntax error

## Getting Help

### Before Reporting Issues

Collect:
1. Investigation context (org, symptom, objects)
2. Error messages (full text)
3. Logs from `runtime/agent_workspace/logs/`
4. VS Code version: Help → About
5. Extension version: Extensions → SF Debug Agent
6. Salesforce CLI version: `sf --version`

### Report an Issue

**GitHub Issues**: [Repository URL]

**Include**:
- Clear description of problem
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (sanitize sensitive data)
- Environment info

### Community Support

**Stack Overflow**: Tag with `salesforce-debugging-agent`

**Salesforce Developers**: Post in Tooling forum

### Emergency Support

**Production Incident**: Contact your Salesforce admin

**Security Issue**: See [security.md](./security.md) for responsible disclosure

## Preventive Maintenance

### Regular Tasks

**Weekly**:
- Clear old logs: `rm -rf runtime/agent_workspace/logs/*`
- Update Salesforce CLI: `sf update`

**Monthly**:
- Update extension when prompted
- Review and archive old investigations
- Check for VS Code updates

**Quarterly**:
- Review safety guard effectiveness
- Update investigation templates
- Rotate API keys (if policy requires)

### Health Checks

**Verify Everything Works**:
```bash
# Check Node.js
node --version

# Check npm
npm --version

# Check Salesforce CLI
sf --version

# Check org authentication
sf org list

# Check workspace structure
ls -la runtime/
```

**Test Investigation**:
1. Create test investigation (sandbox org)
2. Use known good record
3. Verify plan generates
4. Run simple query
5. Check reports generate

## Known Limitations

### Cannot Investigate

- Orgs without API access
- Orgs without CLI authentication
- Objects without read permission
- Deleted records
- Archived data

### AI Limitations

- May not catch all edge cases
- Confidence varies by complexity
- Requires good context to be accurate
- Cannot access non-queryable metadata

### Performance Limits

- Max 10 example records per investigation
- Max 15 steps per plan
- AI token limits apply
- Large query results may timeout

## Advanced Troubleshooting

### Developer Console

Access: Help → Toggle Developer Tools

**Useful For**:
- JavaScript errors
- Extension logs
- Network requests
- Performance profiling

**Look For**:
- Red errors in Console tab
- Failed network requests
- Extension activation issues

### Extension Host Log

Access: Help → Developer: Show Logs → Extension Host

**Contains**:
- Extension lifecycle events
- Command execution
- Error stack traces

### Verbose Logging

**Enable**:
Add to `.vscode/settings.json`:
```json
{
  "sfDebug.verboseLogging": true
}
```

**Produces**:
- Detailed step execution logs
- AI request/response logs (sanitized)
- Safety guard decisions

### Manual Command Execution

**Test CLI Commands Manually**:
```bash
# Query
sf data query --query "SELECT Id FROM Account LIMIT 1" --json -o myOrg

# Apex
sf apex run --file script.apex -o myOrg

# Retrieve
sf project retrieve start -m Flow -o myOrg
```

**Compare Output**:
- Manual vs extension execution
- Helps isolate extension issues
- Verify CLI configuration

### Reset Everything

**Nuclear Option** (when nothing else works):
```bash
# Remove all investigation data
rm -rf runtime/

# Remove node modules
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Recompile
npm run compile

# Reload VS Code
# Command Palette → Developer: Reload Window
```

**Reconfigure**:
1. Set API key: `SF Debug: Configure Anthropic API Key`
2. Test investigation with known good data
3. Report issue if still failing

## Still Stuck?

If this guide doesn't resolve your issue:

1. **Search Existing Issues**: Check GitHub for similar problems
2. **Ask Community**: Stack Overflow with full context
3. **File Bug Report**: Include all requested information
4. **Contact Maintainers**: For security/urgent issues only

**Remember**:
- Most issues are configuration or environment
- Logs are your best friend
- Start simple, add complexity gradually
- When in doubt, test in sandbox first
