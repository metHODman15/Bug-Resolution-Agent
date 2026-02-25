/**
 * CLI Allowlist - Only permits read-only Salesforce CLI commands
 * This guard ensures no deployment or data modification commands are executed
 */

export class CliAllowlist {
    private static readonly ALLOWED_COMMANDS = [
        'sf data query',
        'sf apex run',
        'sf project retrieve start'
    ];

    private static readonly FORBIDDEN_PATTERNS = [
        'deploy',
        'push',
        'delete',
        'create',
        'update',
        'insert',
        'upsert',
        'undelete'
    ];

    /**
     * Validates if a command is allowed by the allowlist
     * @param command The full command string to validate
     * @returns true if command is allowed, false otherwise
     */
    static isCommandAllowed(command: string): boolean {
        const normalizedCmd = command.trim().toLowerCase();
        
        // Check if command starts with any allowed pattern
        const isAllowed = this.ALLOWED_COMMANDS.some(allowed => 
            normalizedCmd.startsWith(allowed.toLowerCase())
        );

        if (!isAllowed) {
            return false;
        }

        // Check for forbidden patterns
        const hasForbidden = this.FORBIDDEN_PATTERNS.some(forbidden =>
            normalizedCmd.includes(forbidden)
        );

        if (hasForbidden) {
            return false;
        }

        // Additional validation for specific command types
        if (normalizedCmd.startsWith('sf data query')) {
            return this.validateQueryCommand(normalizedCmd);
        }

        if (normalizedCmd.startsWith('sf apex run')) {
            return this.validateApexCommand(normalizedCmd);
        }

        if (normalizedCmd.startsWith('sf project retrieve')) {
            return this.validateRetrieveCommand(normalizedCmd);
        }

        return false;
    }

    /**
     * Validates sf data query commands
     */
    private static validateQueryCommand(command: string): boolean {
        // Must use either --query (inline SOQL) or --file (file-based SOQL)
        const hasQueryFlag = command.includes('--query') || command.includes(' -q ');
        const hasFileFlag  = command.includes('--file')  || command.includes(' -f ');

        if (!hasQueryFlag && !hasFileFlag) {
            return false;
        }

        // Must output JSON for parsing
        if (!command.includes('--json')) {
            return false;
        }

        return true;
    }

    /**
     * Validates sf apex run commands
     */
    private static validateApexCommand(command: string): boolean {
        // Must use --file flag
        if (!command.includes('--file')) {
            return false;
        }

        // Additional DML check will be done on file content
        return true;
    }

    /**
     * Validates sf project retrieve commands
     */
    private static validateRetrieveCommand(command: string): boolean {
        // Retrieve is inherently read-only
        // Must specify metadata type
        return command.includes('--metadata') || 
               command.includes('-m') ||
               command.includes('--source-dir');
    }

    /**
     * Gets a human-readable explanation of why a command was rejected
     */
    static getReasonForRejection(command: string): string {
        const normalizedCmd = command.trim().toLowerCase();

        const hasForbidden = this.FORBIDDEN_PATTERNS.some(forbidden =>
            normalizedCmd.includes(forbidden)
        );

        if (hasForbidden) {
            return 'Command contains forbidden operations (deploy, push, delete, modify data)';
        }

        const matchesAllowed = this.ALLOWED_COMMANDS.some(allowed =>
            normalizedCmd.startsWith(allowed.toLowerCase())
        );

        if (!matchesAllowed) {
            return `Command must start with one of: ${this.ALLOWED_COMMANDS.join(', ')}`;
        }

        if (normalizedCmd.startsWith('sf data query')) {
            if (!normalizedCmd.includes('--file')) {
                return 'Query commands must use --file flag';
            }
            if (!normalizedCmd.includes('--json')) {
                return 'Query commands must include --json flag';
            }
        }

        if (normalizedCmd.startsWith('sf apex run')) {
            if (!normalizedCmd.includes('--file')) {
                return 'Apex commands must use --file flag';
            }
        }

        return 'Command does not meet safety requirements';
    }
}
