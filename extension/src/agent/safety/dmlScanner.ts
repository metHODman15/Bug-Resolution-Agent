/**
 * DML Scanner - Detects and blocks Data Manipulation Language operations in Apex code
 * Ensures all Apex scripts are read-only
 */

export class DmlScanner {
    private static readonly DML_KEYWORDS = [
        'insert',
        'update',
        'delete',
        'upsert',
        'undelete',
        'merge'
    ];

    private static readonly DATABASE_DML_METHODS = [
        'Database.insert',
        'Database.update',
        'Database.delete',
        'Database.upsert',
        'Database.undelete',
        'Database.merge',
        'Database.convertLead',
        'Database.emptyRecycleBin'
    ];

    private static readonly HTTP_METHODS = [
        'HttpRequest',
        'Http.send',
        'Messaging.sendEmail'
    ];

    /**
     * Scans Apex code for DML operations
     * @param code The Apex code to scan
     * @returns Object with hasDml flag and list of violations
     */
    static scanApexCode(code: string): { hasDml: boolean; violations: string[] } {
        const violations: string[] = [];
        const normalizedCode = this.normalizeCode(code);

        // Check for direct DML statements
        for (const keyword of this.DML_KEYWORDS) {
            const regex = new RegExp(`\\b${keyword}\\s+`, 'gi');
            const matches = normalizedCode.match(regex);
            if (matches) {
                violations.push(`Direct DML statement: ${keyword.toUpperCase()}`);
            }
        }

        // Check for Database class DML methods
        for (const method of this.DATABASE_DML_METHODS) {
            if (normalizedCode.includes(method.toLowerCase())) {
                violations.push(`Database DML method: ${method}`);
            }
        }

        // Check for HTTP callouts (can modify external systems)
        for (const method of this.HTTP_METHODS) {
            if (normalizedCode.includes(method.toLowerCase())) {
                violations.push(`HTTP callout detected: ${method} (potential external modification)`);
            }
        }

        return {
            hasDml: violations.length > 0,
            violations
        };
    }

    /**
     * Validates if Apex code is safe to execute (read-only)
     * @param code The Apex code to validate
     * @returns true if code is safe, false otherwise
     */
    static isApexCodeSafe(code: string): boolean {
        const result = this.scanApexCode(code);
        return !result.hasDml;
    }

    /**
     * Generates a detailed report of DML violations
     * @param code The Apex code to analyze
     * @returns Formatted violation report
     */
    static generateViolationReport(code: string): string {
        const result = this.scanApexCode(code);
        
        if (!result.hasDml) {
            return 'No DML violations detected. Code is read-only.';
        }

        let report = 'DML VIOLATIONS DETECTED:\n\n';
        result.violations.forEach((violation, index) => {
            report += `${index + 1}. ${violation}\n`;
        });
        
        report += '\n⚠️ Code execution blocked for safety.';
        
        return report;
    }

    /**
     * Normalizes code by removing comments and extra whitespace
     */
    private static normalizeCode(code: string): string {
        // Remove single-line comments
        let normalized = code.replace(/\/\/.*/g, '');
        
        // Remove multi-line comments
        normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Remove string literals (to avoid false positives)
        normalized = normalized.replace(/'[^']*'/g, '');
        normalized = normalized.replace(/"[^"]*"/g, '');
        
        // Convert to lowercase for case-insensitive matching
        normalized = normalized.toLowerCase();
        
        // Normalize whitespace
        normalized = normalized.replace(/\s+/g, ' ');
        
        return normalized;
    }

    /**
     * Suggests read-only alternatives for common patterns
     */
    static suggestAlternatives(violations: string[]): string[] {
        const suggestions: string[] = [];

        if (violations.some(v => v.includes('insert') || v.includes('update'))) {
            suggestions.push('Use SOQL queries to read data instead of modifying it');
            suggestions.push('Use System.debug() to log what would be changed');
        }

        if (violations.some(v => v.includes('delete'))) {
            suggestions.push('Query the records to understand what would be deleted');
        }

        if (violations.some(v => v.includes('HttpRequest'))) {
            suggestions.push('Document the HTTP callout instead of executing it');
            suggestions.push('Review endpoint configuration in metadata');
        }

        return suggestions;
    }
}
