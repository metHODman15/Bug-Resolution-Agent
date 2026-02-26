/**
 * Agent instructions — loaded from .github/ markdown files at runtime.
 *
 * The extension reads these repo-controlled markdown files:
 *   - .github/AGENTS.md
 *   - .github/copilot-instructions.md
 *
 * Precedence: hardcoded system policy > AGENTS.md > copilot-instructions.md
 *
 * For the full structured parser, see markdownParser.ts.
 * This module provides backward-compatible named exports for existing callers.
 */
import * as fs from 'fs';
import * as path from 'path';

function loadMd(relativePath: string): string {
    // __dirname is out/agent/ at runtime; resolve up to the extension root
    const root = path.resolve(__dirname, '..', '..', '..');
    const full = path.join(root, relativePath);
    try {
        return fs.readFileSync(full, 'utf8');
    } catch {
        return '<!-- ' + relativePath + ' not found — add this file before packaging -->';
    }
}

let cachedSystem: string | undefined;
let cachedAnalysis: string | undefined;

export function getSystemInstructions(): string {
    if (!cachedSystem) {
        const agents       = loadMd('.github/AGENTS.md');
        const instructions = loadMd('.github/copilot-instructions.md');
        cachedSystem =
            agents + '\n\n---\n\n' + instructions + '\n\n---\n\n' +
            '## Runtime context\n\n' +
            '- The workspace root is auto-detected from the active VS Code workspace.\n' +
            '- The user only needs to describe what to build next.\n';
    }
    return cachedSystem;
}

export function getAnalysisInstructions(): string {
    if (!cachedAnalysis) {
        const agents = loadMd('.github/AGENTS.md');
        cachedAnalysis =
            agents + '\n\n---\n\n' +
            '## Analysis task\n\n' +
            'Analyse the results provided.\n' +
            'Classify the root cause and provide structured markdown.\n';
    }
    return cachedAnalysis;
}

// Legacy named exports kept so existing callers compile without changes
export const SYSTEM_INSTRUCTIONS   = '';
export const ANALYSIS_INSTRUCTIONS = '';
