import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PlanStep } from '../state';
import { CliAllowlist } from '../safety/cliAllowlist';
import { DmlScanner } from '../safety/dmlScanner';
import { PathGuard } from '../safety/pathGuard';
import { HQ2ProdGuard } from '../safety/hq2prodGuard';

const execAsync = promisify(exec);

export class SfCliRunner {
    private orgAlias: string;
    private workspaceRoot: string;

    constructor(orgAlias: string) {
        this.orgAlias = orgAlias;
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            throw new Error('No workspace folder open');
        }
        this.workspaceRoot = workspace.uri.fsPath;
    }

    /**
     * Detect the default Salesforce org connected to SF CLI.
     * Returns the alias/username of the default org, or undefined if none is found.
     */
    static async detectDefaultOrg(): Promise<string | undefined> {
        try {
            const { stdout } = await execAsync('sf org list --json');
            const parsed = JSON.parse(stdout) as {
                result?: {
                    nonScratchOrgs?: Array<{ alias?: string; username?: string; isDefaultUsername?: boolean }>;
                    scratchOrgs?: Array<{ alias?: string; username?: string; isDefaultUsername?: boolean }>;
                };
            };
            const all = [
                ...(parsed.result?.nonScratchOrgs ?? []),
                ...(parsed.result?.scratchOrgs ?? []),
            ];
            const def = all.find(o => o.isDefaultUsername);
            if (def) { return def.alias ?? def.username; }
            // Fall back to first available org
            if (all.length > 0) { return all[0].alias ?? all[0].username; }
        } catch {
            // SF CLI not available or no orgs connected
        }
        return undefined;
    }

    /**
     * Return the alias used by this runner instance.
     */
    getOrgAlias(): string { return this.orgAlias; }

    async executeStep(step: PlanStep): Promise<string> {
        switch (step.type) {
            case 'query':
                return await this.executeQuery(step);
            case 'apex':
                return await this.executeApex(step);
            case 'retrieve':
                return await this.executeRetrieve(step);
            case 'analysis':
                return await this.performAnalysis(step);
            default:
                throw new Error(`Unknown step type: ${step.type}`);
        }
    }

    private async executeQuery(step: PlanStep): Promise<string> {
        if (!step.command) {
            throw new Error('Query step missing command');
        }

        // Validate command against allowlist
        const cmd = step.command!;
        if (!CliAllowlist.isCommandAllowed(cmd)) {
            const reason = CliAllowlist.getReasonForRejection(cmd);
            throw new Error(`Command not allowed: ${reason}`);
        }

        // Create SOQL file if filePath is specified
        if (step.filePath) {
            await this.ensureScriptFile(step.filePath, this.generateDefaultSOQL(step));
        }

        // Wrap execution with production safeguards
        return await HQ2ProdGuard.wrapCommandExecution(
            this.orgAlias,
            step.command,
            async () => {
                const { stdout, stderr } = await execAsync(cmd);
                
                // Log output
                await this.logOutput('query', step.id, stdout, stderr);
                
                if (stderr) {
                    console.warn(`Query stderr: ${stderr}`);
                }

                return stdout;
            }
        );
    }

    private async executeApex(step: PlanStep): Promise<string> {
        if (!step.command) {
            throw new Error('Apex step missing command');
        }

        // Validate command against allowlist
        const cmd = step.command!;
        if (!CliAllowlist.isCommandAllowed(cmd)) {
            const reason = CliAllowlist.getReasonForRejection(cmd);
            throw new Error(`Command not allowed: ${reason}`);
        }

        // Read Apex file and scan for DML
        if (step.filePath) {
            const apexCode = await this.readScriptFile(step.filePath);
            const scanResult = DmlScanner.scanApexCode(apexCode);
            
            if (scanResult.hasDml) {
                const report = DmlScanner.generateViolationReport(apexCode);
                throw new Error(`DML detected in Apex code:\n${report}`);
            }
        }

        // Wrap execution with production safeguards
        return await HQ2ProdGuard.wrapCommandExecution(
            this.orgAlias,
            step.command,
            async () => {
                const { stdout, stderr } = await execAsync(cmd);
                
                // Log output
                await this.logOutput('apex', step.id, stdout, stderr);
                
                if (stderr) {
                    console.warn(`Apex stderr: ${stderr}`);
                }

                return stdout;
            }
        );
    }

    private async executeRetrieve(step: PlanStep): Promise<string> {
        if (!step.command) {
            throw new Error('Retrieve step missing command');
        }

        // Validate command
        if (!CliAllowlist.isCommandAllowed(step.command)) {
            const reason = CliAllowlist.getReasonForRejection(step.command);
            throw new Error(`Command not allowed: ${reason}`);
        }

        // Ensure retrieve goes to quarantine directory
        const quarantineDir = PathGuard.createSafePath('metadata', this.workspaceRoot);
        const retrieveCommand = this.ensureQuarantinedRetrieve(step.command, quarantineDir);

        return await HQ2ProdGuard.wrapCommandExecution(
            this.orgAlias,
            retrieveCommand,
            async () => {
                const { stdout, stderr } = await execAsync(retrieveCommand);
                
                // Log output
                await this.logOutput('retrieve', step.id, stdout, stderr);
                
                if (stderr) {
                    console.warn(`Retrieve stderr: ${stderr}`);
                }

                return stdout;
            }
        );
    }

    private async performAnalysis(step: PlanStep): Promise<string> {
        // Analysis steps don't execute commands, just return description
        return `Analysis step: ${step.description}`;
    }

    private async ensureScriptFile(filePath: string, defaultContent: string): Promise<void> {
        const absolutePath = path.isAbsolute(filePath) 
            ? filePath 
            : path.join(this.workspaceRoot, filePath);

        // Validate write path
        if (!PathGuard.isWriteAllowed(absolutePath, this.workspaceRoot)) {
            throw new Error(
                PathGuard.getReasonForRejection(absolutePath, this.workspaceRoot, 'write')
            );
        }

        // Create directory if needed
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Write file if it doesn't exist
        if (!fs.existsSync(absolutePath)) {
            fs.writeFileSync(absolutePath, defaultContent, 'utf8');
        }
    }

    private async readScriptFile(filePath: string): Promise<string> {
        const absolutePath = path.isAbsolute(filePath) 
            ? filePath 
            : path.join(this.workspaceRoot, filePath);

        // Validate read path
        if (!PathGuard.isReadAllowed(absolutePath, this.workspaceRoot)) {
            throw new Error(
                PathGuard.getReasonForRejection(absolutePath, this.workspaceRoot, 'read')
            );
        }

        return fs.readFileSync(absolutePath, 'utf8');
    }

    private async logOutput(type: string, stepId: string, stdout: string, stderr: string): Promise<void> {
        const logsDir = PathGuard.createSafePath('logs', this.workspaceRoot);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(logsDir, `${type}-${stepId}-${timestamp}.log`);

        const logContent = `=== ${type.toUpperCase()} OUTPUT ===\n` +
            `Step: ${stepId}\n` +
            `Timestamp: ${timestamp}\n` +
            `Org: ${this.orgAlias}\n\n` +
            `STDOUT:\n${stdout}\n\n` +
            `STDERR:\n${stderr}\n`;

        fs.writeFileSync(logFile, logContent, 'utf8');
    }

    private generateDefaultSOQL(step: PlanStep): string {
        return `-- Auto-generated SOQL query
-- Step: ${step.description}
-- Generated: ${new Date().toISOString()}

SELECT Id, Name, CreatedDate, LastModifiedDate
FROM Account
LIMIT 10
`;
    }

    private ensureQuarantinedRetrieve(command: string, quarantineDir: string): string {
        // Ensure --target-dir points to quarantine
        if (command.includes('--target-dir')) {
            return command.replace(/--target-dir\s+\S+/, `--target-dir ${quarantineDir}`);
        } else {
            return `${command} --target-dir ${quarantineDir}`;
        }
    }
}
