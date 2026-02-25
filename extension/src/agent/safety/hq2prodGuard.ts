import * as vscode from 'vscode';

/**
 * HQ2Prod Guard - Special protection for production org operations
 * Implements additional safeguards and logging for HQ2Prod org alias
 */

export class HQ2ProdGuard {
    private static readonly PROD_ORG_ALIAS = 'HQ2Prod';
    private static readonly WARNING_MESSAGE = 
        '⚠️ WARNING: You are about to run an investigation against HQ2Prod (PRODUCTION).\n\n' +
        'This is a READ-ONLY investigation, but please confirm:\n' +
        '• You have proper authorization\n' +
        '• You understand this is the production environment\n' +
        '• All operations will be logged\n\n' +
        'Do you want to proceed?';

    /**
     * Checks if an org alias is a production org requiring special handling
     */
    static isProductionOrg(orgAlias: string): boolean {
        return orgAlias === this.PROD_ORG_ALIAS ||
               orgAlias.toLowerCase().includes('prod') ||
               orgAlias.toLowerCase().includes('production');
    }

    /**
     * Shows confirmation dialog for production org access
     * @returns true if user confirms, false otherwise
     */
    static async confirmProductionAccess(orgAlias: string): Promise<boolean> {
        if (!this.isProductionOrg(orgAlias)) {
            return true;
        }

        const action = await vscode.window.showWarningMessage(
            this.WARNING_MESSAGE,
            { modal: true },
            'I Understand - Proceed',
            'Cancel'
        );

        const confirmed = action === 'I Understand - Proceed';

        if (confirmed) {
            this.logProductionAccess(orgAlias);
        }

        return confirmed;
    }

    /**
     * Logs production org access for audit trail
     */
    private static logProductionAccess(orgAlias: string): void {
        const timestamp = new Date().toISOString();
        const user = process.env.USER || process.env.USERNAME || 'unknown';
        
        console.log('=== PRODUCTION ORG ACCESS ===');
        console.log(`Timestamp: ${timestamp}`);
        console.log(`User: ${user}`);
        console.log(`Org: ${orgAlias}`);
        console.log(`Operation: Read-only investigation`);
        console.log('============================');
    }

    /**
     * Enhanced validation for production org operations
     */
    static async validateProductionOperation(
        orgAlias: string,
        operation: string,
        details: string
    ): Promise<boolean> {
        if (!this.isProductionOrg(orgAlias)) {
            return true;
        }

        // Log all production operations
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] PROD Operation: ${operation} - ${details}`);

        // For any write-like operation (even though we shouldn't have any),
        // show additional warning
        const writeKeywords = ['deploy', 'push', 'update', 'delete', 'create'];
        const isWriteOperation = writeKeywords.some(keyword => 
            operation.toLowerCase().includes(keyword)
        );

        if (isWriteOperation) {
            vscode.window.showErrorMessage(
                `⛔ BLOCKED: Write operation "${operation}" is not allowed on production org ${orgAlias}`
            );
            return false;
        }

        return true;
    }

    /**
     * Wraps a command execution with production safeguards
     */
    static async wrapCommandExecution<T>(
        orgAlias: string,
        command: string,
        executor: () => Promise<T>
    ): Promise<T> {
        if (this.isProductionOrg(orgAlias)) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] PROD Command: ${command}`);
            
            // Add visual indicator in status bar
            vscode.window.setStatusBarMessage(
                `⚠️ PRODUCTION: ${command}`,
                5000
            );
        }

        try {
            return await executor();
        } catch (error) {
            if (this.isProductionOrg(orgAlias)) {
                console.error(`[PROD ERROR] Command failed: ${command}`, error);
            }
            throw error;
        }
    }

    /**
     * Creates a production-safe execution context
     */
    static createProductionContext(orgAlias: string): ProductionContext {
        return {
            orgAlias,
            isProduction: this.isProductionOrg(orgAlias),
            startTime: new Date().toISOString(),
            operations: []
        };
    }
}

export interface ProductionContext {
    orgAlias: string;
    isProduction: boolean;
    startTime: string;
    operations: string[];
}
