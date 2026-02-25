import * as path from 'path';
import * as fs from 'fs';

/**
 * Path Guard - Restricts file system operations to safe directories only
 * Prevents writes to source directories and other sensitive locations
 */

export class PathGuard {
    private static readonly ALLOWED_WRITE_DIRS = [
        'runtime/scripts',
        'runtime/agent_workspace',
        'runtime/Reports'
    ];

    private static readonly FORBIDDEN_WRITE_DIRS = [
        'force-app',
        'src',
        'extension',
        'agent_templates',
        'node_modules',
        '.sfdx',
        '.sf',
        '.git',
        '.vscode'
    ];

    /**
     * Validates if a write operation to a path is allowed
     * @param targetPath The path to validate (can be relative or absolute)
     * @param workspaceRoot The workspace root directory
     * @returns true if write is allowed, false otherwise
     */
    static isWriteAllowed(targetPath: string, workspaceRoot: string): boolean {
        // Normalize the path
        const absolutePath = path.isAbsolute(targetPath) 
            ? targetPath 
            : path.join(workspaceRoot, targetPath);
        
        // Get relative path from workspace root
        const relativePath = path.relative(workspaceRoot, absolutePath);
        
        // Prevent path traversal attacks
        if (relativePath.startsWith('..')) {
            return false;
        }

        // Check if path is in forbidden directories
        const isInForbiddenDir = this.FORBIDDEN_WRITE_DIRS.some(forbidden => {
            const normalizedForbidden = forbidden.split('/').join(path.sep);
            const normalizedRelative = relativePath.split('/').join(path.sep);
            return normalizedRelative.startsWith(normalizedForbidden);
        });

        if (isInForbiddenDir) {
            return false;
        }

        // Check if path is in allowed directories
        const isInAllowedDir = this.ALLOWED_WRITE_DIRS.some(allowed => {
            const normalizedAllowed = allowed.split('/').join(path.sep);
            const normalizedRelative = relativePath.split('/').join(path.sep);
            return normalizedRelative.startsWith(normalizedAllowed);
        });

        return isInAllowedDir;
    }

    /**
     * Validates if a read operation to a path is allowed
     * @param targetPath The path to validate
     * @param workspaceRoot The workspace root directory
     * @returns true if read is allowed, false otherwise
     */
    static isReadAllowed(targetPath: string, workspaceRoot: string): boolean {
        // Normalize the path
        const absolutePath = path.isAbsolute(targetPath) 
            ? targetPath 
            : path.join(workspaceRoot, targetPath);
        
        // Get relative path from workspace root
        const relativePath = path.relative(workspaceRoot, absolutePath);
        
        // Prevent path traversal attacks
        if (relativePath.startsWith('..')) {
            return false;
        }

        // Reading is generally allowed within workspace
        // but block sensitive files
        const forbiddenFiles = ['.env', '*.key', '*.pem', '*.p12'];
        const basename = path.basename(relativePath);
        
        for (const pattern of forbiddenFiles) {
            if (pattern.startsWith('*')) {
                const ext = pattern.substring(1);
                if (basename.endsWith(ext)) {
                    return false;
                }
            } else if (basename === pattern) {
                return false;
            }
        }

        return true;
    }

    /**
     * Creates safe directory path for writing
     * @param category The category of output (scripts, logs, findings, etc.)
     * @param workspaceRoot The workspace root directory
     * @returns Safe absolute path for writing
     */
    static createSafePath(category: string, workspaceRoot: string): string {
        const categoryMap: Record<string, string> = {
            'soql': 'runtime/scripts/soql',
            'apex': 'runtime/scripts/apex',
            'logs': 'runtime/agent_workspace/logs',
            'findings': 'runtime/agent_workspace/findings',
            'plans': 'runtime/agent_workspace/plans',
            'web': 'runtime/agent_workspace/web',
            'metadata': 'runtime/agent_workspace/md',
            'reports': 'runtime/Reports'
        };

        const relativePath = categoryMap[category] || 'runtime/agent_workspace';
        const safePath = path.join(workspaceRoot, relativePath);

        // Ensure directory exists
        if (!fs.existsSync(safePath)) {
            fs.mkdirSync(safePath, { recursive: true });
        }

        return safePath;
    }

    /**
     * Gets reason for path rejection
     */
    static getReasonForRejection(targetPath: string, workspaceRoot: string, operation: 'read' | 'write'): string {
        const absolutePath = path.isAbsolute(targetPath) 
            ? targetPath 
            : path.join(workspaceRoot, targetPath);
        
        const relativePath = path.relative(workspaceRoot, absolutePath);

        if (relativePath.startsWith('..')) {
            return 'Path traversal detected - cannot access paths outside workspace';
        }

        if (operation === 'write') {
            const isInForbiddenDir = this.FORBIDDEN_WRITE_DIRS.some(forbidden => 
                relativePath.startsWith(forbidden)
            );

            if (isInForbiddenDir) {
                return `Write to ${relativePath} is forbidden - protected directory`;
            }

            return `Write to ${relativePath} is not in allowed directories: ${this.ALLOWED_WRITE_DIRS.join(', ')}`;
        }

        return `Read from ${relativePath} is not allowed`;
    }

    /**
     * Sanitizes filename to prevent injection attacks
     */
    static sanitizeFilename(filename: string): string {
        // Remove path separators
        let sanitized = filename.replace(/[/\\]/g, '-');
        
        // Remove special characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Limit length
        if (sanitized.length > 200) {
            const ext = path.extname(sanitized);
            const base = path.basename(sanitized, ext);
            sanitized = base.substring(0, 200 - ext.length) + ext;
        }

        return sanitized;
    }
}
