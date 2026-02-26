import * as assert from 'assert';
import {
    parseAgentsMd,
    parseCopilotInstructions,
    mergeConfigs,
} from '../agent/markdownParser';

suite('Markdown Parser Tests', () => {

    suite('parseAgentsMd', () => {
        test('returns error for empty content', () => {
            const result = parseAgentsMd('');
            assert.strictEqual(result.ok, false);
            assert.ok(result.errors.length > 0);
        });

        test('parses frontmatter schema_version', () => {
            const content = `---
schema_version: "2.0"
---

# AGENTS.md

### Build Agent

Role:
Primary agent

Description:
Builds code
`;
            const result = parseAgentsMd(content);
            assert.strictEqual(result.ok, true);
            assert.strictEqual(result.data?.schemaVersion, '2.0');
        });

        test('parses agent definitions from headings', () => {
            const content = `# AGENTS.md

### Build Agent

Role:
Primary code builder

Goal:
Help users build code

Tools:
- File read/write
- Git diff

Terminal: allowed

### Review Agent

Role:
Code reviewer

Goal:
Review and improve code
`;
            const result = parseAgentsMd(content);
            assert.strictEqual(result.ok, true);
            assert.ok(result.data);
            assert.strictEqual(result.data.agents.length, 2);
            assert.strictEqual(result.data.agents[0].name, 'Build Agent');
            assert.strictEqual(result.data.agents[0].role, 'Primary code builder');
            assert.strictEqual(result.data.agents[0].description, 'Help users build code');
            assert.ok(result.data.agents[0].tools);
            assert.strictEqual(result.data.agents[0].tools!.length, 2);
            assert.strictEqual(result.data.agents[0].allowTerminal, true);

            assert.strictEqual(result.data.agents[1].name, 'Review Agent');
            assert.strictEqual(result.data.agents[1].allowTerminal, false);
        });

        test('creates default agent when no structured agents found', () => {
            const content = `# AGENTS.md

## Some Other Section

Just text, no agent headings.
`;
            const result = parseAgentsMd(content);
            assert.strictEqual(result.ok, true);
            assert.ok(result.data);
            assert.strictEqual(result.data.agents.length, 1);
            assert.strictEqual(result.data.agents[0].name, 'default');
            assert.ok(result.warnings.length > 0);
        });

        test('parses autonomy boundaries', () => {
            const content = `# AGENTS.md

### Test Agent

Role:
Test runner

## Autonomy Boundaries

- No production changes
- No silent failure
`;
            const result = parseAgentsMd(content);
            assert.strictEqual(result.ok, true);
            assert.ok(result.data?.autonomyBoundaries);
            assert.strictEqual(result.data!.autonomyBoundaries!.length, 2);
        });

        test('stores raw content', () => {
            const content = '# AGENTS.md\n\n### My Agent\n\nRole:\nHelper\n';
            const result = parseAgentsMd(content);
            assert.strictEqual(result.ok, true);
            assert.strictEqual(result.data?.raw, content);
        });
    });

    suite('parseCopilotInstructions', () => {
        test('returns error for empty content', () => {
            const result = parseCopilotInstructions('');
            assert.strictEqual(result.ok, false);
            assert.ok(result.errors.length > 0);
        });

        test('parses frontmatter schema_version', () => {
            const content = `---
schema_version: "1.5"
---

# Instructions

## Safety Rules

- Never push to main
`;
            const result = parseCopilotInstructions(content);
            assert.strictEqual(result.ok, true);
            assert.strictEqual(result.data?.schemaVersion, '1.5');
        });

        test('extracts safety rules', () => {
            const content = `# Instructions

## Autonomy Boundaries

- Never modify production
- Never skip tests
- Always validate locally
`;
            const result = parseCopilotInstructions(content);
            assert.strictEqual(result.ok, true);
            assert.ok(result.data?.safetyRules);
            assert.strictEqual(result.data!.safetyRules!.length, 3);
        });

        test('stores full body as systemPolicy', () => {
            const content = `# Instructions

Some instructions here.
`;
            const result = parseCopilotInstructions(content);
            assert.strictEqual(result.ok, true);
            assert.ok(result.data?.systemPolicy);
            assert.ok(result.data!.systemPolicy.length > 0);
        });
    });

    suite('mergeConfigs', () => {
        test('returns defaults when both files are null', () => {
            const merged = mergeConfigs(null, null);
            assert.ok(merged.systemPrompt.length > 0);
            assert.strictEqual(merged.agents.length, 1);
            assert.strictEqual(merged.agents[0].name, 'default');
            assert.strictEqual(merged.agentsParseResult.ok, false);
            assert.strictEqual(merged.instructionsParseResult.ok, false);
        });

        test('merges agents content when provided', () => {
            const agents = `# AGENTS.md\n\n### Build Agent\n\nRole:\nBuilder\n`;
            const merged = mergeConfigs(agents, null);
            assert.ok(merged.systemPrompt.includes('AGENTS.md'));
            assert.strictEqual(merged.agentsParseResult.ok, true);
            assert.strictEqual(merged.instructionsParseResult.ok, false);
        });

        test('merges instructions content when provided', () => {
            const instructions = `# Instructions\n\n## Safety\n\n- Be safe\n`;
            const merged = mergeConfigs(null, instructions);
            assert.ok(merged.systemPrompt.includes('Instructions'));
            assert.strictEqual(merged.instructionsParseResult.ok, true);
        });

        test('hardcoded policy is always first in system prompt', () => {
            const agents = `# AGENTS.md\n\n### Agent\n\nRole:\nHelper\n`;
            const instructions = `# Instructions\n\nSome rules.\n`;
            const merged = mergeConfigs(agents, instructions);

            // Hardcoded policy must come before AGENTS.md content
            const policyIdx = merged.systemPrompt.indexOf('white-label build agent');
            const agentsIdx = merged.systemPrompt.indexOf('AGENTS.md');
            assert.ok(policyIdx < agentsIdx, 'Hardcoded policy must precede AGENTS.md');
        });

        test('precedence: hardcoded > AGENTS.md > copilot-instructions.md', () => {
            const agents = `# AGENTS.md\n\nAgent rules.\n`;
            const instructions = `# Copilot Instructions\n\nInstruction rules.\n`;
            const merged = mergeConfigs(agents, instructions);

            const policyIdx = merged.systemPrompt.indexOf('white-label build agent');
            const agentsIdx = merged.systemPrompt.indexOf('Agent rules');
            const instrIdx  = merged.systemPrompt.indexOf('Instruction rules');

            assert.ok(policyIdx >= 0, 'Hardcoded policy must be present');
            assert.ok(agentsIdx >= 0, 'AGENTS.md content must be present');
            assert.ok(instrIdx >= 0, 'Instructions content must be present');
            assert.ok(policyIdx < agentsIdx, 'Hardcoded < AGENTS.md');
            assert.ok(agentsIdx < instrIdx, 'AGENTS.md < Instructions');
        });
    });
});
