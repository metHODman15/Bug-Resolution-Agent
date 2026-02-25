/**
 * Agent instructions — loaded from copilot-reference-mds/ at runtime.
 *
 * HOW TO CUSTOMISE FOR EACH DEPLOYMENT:
 *   1. Edit  copilot-reference-mds/copilot-instructions.md  (investigation rules, report format)
 *   2. Edit  copilot-reference-mds/AGENTS.md               (agent persona and capabilities)
 *   3. Run   npm run package:vsix
 *   4. Distribute extension.vsix — each recipient enters their own Anthropic API key.
 *
 * The two markdown files are bundled inside the VSIX and read synchronously on first use.
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

let _system: string | undefined;
let _analysis: string | undefined;

export function getSystemInstructions(): string {
    if (!_system) {
        const agents       = loadMd('copilot-reference-mds/AGENTS.md');
        const instructions = loadMd('copilot-reference-mds/copilot-instructions.md');
        _system =
            agents + '\n\n---\n\n' + instructions + '\n\n---\n\n' +
            '## Runtime context\n\n' +
            '- The org alias is auto-detected from the active SF CLI connection; do NOT ask the user for it.\n' +
            '- Do NOT demand object names or record IDs upfront; ask only if you genuinely cannot proceed.\n' +
            '- The user only needs to describe the symptom in plain English.\n' +
            '- Produce your investigation plan as a JSON array inside a ```json code block.\n' +
            '- Each step: { "type": "query"|"retrieve"|"apex"|"analysis", "description": "...", "command"?: "...", "filePath"?: "..." }\n';
    }
    return _system;
}

export function getAnalysisInstructions(): string {
    if (!_analysis) {
        const agents = loadMd('copilot-reference-mds/AGENTS.md');
        _analysis =
            agents + '\n\n---\n\n' +
            '## Analysis task\n\n' +
            'Analyse the Salesforce investigation results provided.\n' +
            'Classify the root cause: data-quality issue, configuration/automation defect, or both.\n\n' +
            'Provide structured markdown with Root Cause, Explanation, Affected Records, Recommended Actions.\n\n' +
            'Then output a JSON block:\n' +
            '```json\n' +
            '{ "primaryCause": "data|system|configuration|permission|unknown",\n' +
            '  "confidence": "high|medium|low",\n' +
            '  "explanation": "...",\n' +
            '  "affectedRecords": [...],\n' +
            '  "recommendedActions": [...] }\n' +
            '```';
    }
    return _analysis;
}

// Legacy named exports kept so existing callers compile without changes
export const SYSTEM_INSTRUCTIONS   = '';
export const ANALYSIS_INSTRUCTIONS = '';
