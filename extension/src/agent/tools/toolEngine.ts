/**
 * Tool engine — gives the LLM real tools to use during an investigation.
 *
 * Tools exposed to the model:
 *   run_sf_command  — run a read-only SF CLI command and return stdout
 *   write_file      — write a file inside the allowed workspace locations
 *   read_file       — read a file from the workspace
 *   list_dir        — list directory contents
 *
 * The agentic loop:
 *   1. Send messages + tool definitions to the model.
 *   2. If the model returns a tool call, execute it and append the result.
 *   3. Repeat until the model returns a plain text response (no tool calls).
 *
 * Safety: all commands pass through CliAllowlist and PathGuard. No DML.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import Anthropic from '@anthropic-ai/sdk';
import type {
    Tool as AnthropicTool,
    ToolUseBlock,
    ToolResultBlockParam,
    ToolsBetaMessageParam,
} from '@anthropic-ai/sdk/resources/beta/tools/messages';
import OpenAI from 'openai';
import { CliAllowlist } from '../safety/cliAllowlist';
import { PathGuard } from '../safety/pathGuard';
import { detectProvider } from '../../services/llmClient';

const execAsync = promisify(exec);

// ─── types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AgentToolResult {
    tool: string;
    input: Record<string, string>;
    output: string;
    error?: boolean;
}

// ─── tool definitions (Anthropic format) ─────────────────────────────────────

const TOOL_DEFS_ANTHROPIC: AnthropicTool[] = [
    {
        name: 'run_sf_command',
        description:
            'Run a read-only Salesforce CLI command (sf data query, sf apex run, sf project retrieve start). ' +
            'Never runs deploy or DML. Returns stdout of the command.',
        input_schema: {
            type: 'object' as const,
            properties: {
                command: {
                    type: 'string',
                    description: 'The full SF CLI command to execute, e.g. "sf data query --query \\"SELECT Id FROM Account LIMIT 1\\" --json --target-org myOrg"',
                },
            },
            required: ['command'],
        },
    },
    {
        name: 'write_file',
        description:
            'Write content to a file inside the workspace. Allowed paths: runtime/scripts/, runtime/agent_workspace/, runtime/Reports/. ' +
            'Use this to save SOQL scripts, findings, and the final BU.md, Tech Document.md, Client.md reports.',
        input_schema: {
            type: 'object' as const,
            properties: {
                path: {
                    type: 'string',
                    description: 'Workspace-relative path, e.g. "runtime/Reports/2025-01-15-login-issue/BU.md"',
                },
                content: {
                    type: 'string',
                    description: 'File content to write.',
                },
            },
            required: ['path', 'content'],
        },
    },
    {
        name: 'read_file',
        description: 'Read the contents of a file from the workspace.',
        input_schema: {
            type: 'object' as const,
            properties: {
                path: {
                    type: 'string',
                    description: 'Workspace-relative or absolute path to the file.',
                },
            },
            required: ['path'],
        },
    },
    {
        name: 'list_dir',
        description: 'List the contents of a directory in the workspace.',
        input_schema: {
            type: 'object' as const,
            properties: {
                path: {
                    type: 'string',
                    description: 'Workspace-relative or absolute path to the directory.',
                },
            },
            required: ['path'],
        },
    },
];

// OpenAI/Grok format
const TOOL_DEFS_OPENAI: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'run_sf_command',
            description:
                'Run a read-only Salesforce CLI command (sf data query, sf apex run, sf project retrieve start). ' +
                'Never runs deploy or DML. Returns stdout of the command.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'Full SF CLI command to run.' },
                },
                required: ['command'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'write_file',
            description:
                'Write content to a file inside the workspace. Allowed paths: runtime/scripts/, runtime/agent_workspace/, runtime/Reports/.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Workspace-relative file path.' },
                    content: { type: 'string', description: 'Content to write.' },
                },
                required: ['path', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Read a file from the workspace.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Workspace-relative or absolute file path.' },
                },
                required: ['path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_dir',
            description: 'List directory contents.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Workspace-relative or absolute directory path.' },
                },
                required: ['path'],
            },
        },
    },
];

// ─── tool execution ───────────────────────────────────────────────────────────

async function executeTool(
    name: string,
    input: Record<string, string>,
    workspaceRoot: string,
): Promise<string> {
    try {
        switch (name) {
            case 'run_sf_command': return await toolRunSfCommand(input.command, workspaceRoot);
            case 'write_file':     return await toolWriteFile(input.path, input.content, workspaceRoot);
            case 'read_file':      return await toolReadFile(input.path, workspaceRoot);
            case 'list_dir':       return await toolListDir(input.path, workspaceRoot);
            default:               return `Unknown tool: ${name}`;
        }
    } catch (err) {
        return `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
}

async function toolRunSfCommand(command: string, workspaceRoot: string): Promise<string> {
    if (!CliAllowlist.isCommandAllowed(command)) {
        const reason = CliAllowlist.getReasonForRejection(command);
        return `BLOCKED: ${reason}`;
    }
    try {
        const { stdout, stderr } = await execAsync(command, { cwd: workspaceRoot, timeout: 60_000 });
        return (stdout || '(no output)') + (stderr ? `\nSTDERR: ${stderr}` : '');
    } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        return `COMMAND ERROR: ${e.message ?? ''}\nSTDOUT: ${e.stdout ?? ''}\nSTDERR: ${e.stderr ?? ''}`;
    }
}

async function toolWriteFile(relPath: string, content: string, workspaceRoot: string): Promise<string> {
    const abs = path.isAbsolute(relPath) ? relPath : path.join(workspaceRoot, relPath);
    if (!PathGuard.isWriteAllowed(abs, workspaceRoot)) {
        const reason = PathGuard.getReasonForRejection(abs, workspaceRoot, 'write');
        return `BLOCKED (write): ${reason}`;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    return `Written: ${relPath} (${content.length} bytes)`;
}

async function toolReadFile(relPath: string, workspaceRoot: string): Promise<string> {
    const abs = path.isAbsolute(relPath) ? relPath : path.join(workspaceRoot, relPath);
    if (!PathGuard.isReadAllowed(abs, workspaceRoot)) {
        return `BLOCKED (read): path not allowed`;
    }
    if (!fs.existsSync(abs)) { return `NOT FOUND: ${relPath}`; }
    const content = fs.readFileSync(abs, 'utf8');
    return content.length > 15_000 ? content.slice(0, 15_000) + '\n...[truncated]' : content;
}

async function toolListDir(relPath: string, workspaceRoot: string): Promise<string> {
    const abs = path.isAbsolute(relPath) ? relPath : path.join(workspaceRoot, relPath);
    if (!fs.existsSync(abs)) { return `NOT FOUND: ${relPath}`; }
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    return entries.map(e => (e.isDirectory() ? e.name + '/' : e.name)).join('\n') || '(empty)';
}

// ─── Anthropic agentic loop ───────────────────────────────────────────────────

export async function runAgentLoopAnthropic(
    key: string,
    systemPrompt: string,
    history: ToolsBetaMessageParam[],
    workspaceRoot: string,
    onChunk: (text: string) => void,
    onToolCall: (name: string, input: Record<string, string>) => void,
    onToolResult: (name: string, result: string) => void,
): Promise<{ reply: string; updatedHistory: ToolsBetaMessageParam[] }> {
    const client = new Anthropic({ apiKey: key });
    const msgs: ToolsBetaMessageParam[] = [...history];
    let finalText = '';

    for (let iteration = 0; iteration < 20; iteration++) {
        const response = await client.beta.tools.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            system: systemPrompt,
            tools: TOOL_DEFS_ANTHROPIC,
            messages: msgs,
        });

        // Collect all text blocks first for streaming
        let iterText = '';
        const toolUses: ToolUseBlock[] = [];

        for (const block of response.content) {
            if (block.type === 'text') {
                iterText += block.text;
                onChunk(block.text);
            } else if (block.type === 'tool_use') {
                toolUses.push(block);
            }
        }

        // Append assistant message
        msgs.push({ role: 'assistant', content: response.content as ToolsBetaMessageParam['content'] });

        if (response.stop_reason === 'end_turn' || toolUses.length === 0) {
            finalText += iterText;
            break;
        }

        finalText += iterText;

        // Execute each tool call and collect results
        const toolResults: ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
            const input = tu.input as Record<string, string>;
            onToolCall(tu.name, input);
            const result = await executeTool(tu.name, input, workspaceRoot);
            onToolResult(tu.name, result);
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: [{ type: 'text' as const, text: result }] });
        }

        msgs.push({ role: 'user', content: toolResults });
    }

    return { reply: finalText, updatedHistory: msgs };
}

// ─── Grok (OpenAI) agentic loop ───────────────────────────────────────────────

export async function runAgentLoopGrok(
    key: string,
    systemPrompt: string,
    history: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    workspaceRoot: string,
    onChunk: (text: string) => void,
    onToolCall: (name: string, input: Record<string, string>) => void,
    onToolResult: (name: string, result: string) => void,
): Promise<{ reply: string; updatedHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] }> {
    const client = new OpenAI({ apiKey: key, baseURL: 'https://api.x.ai/v1' });
    const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history,
    ];
    let finalText = '';

    for (let iteration = 0; iteration < 20; iteration++) {
        const response = await client.chat.completions.create({
            model: 'grok-3',
            max_tokens: 8192,
            tools: TOOL_DEFS_OPENAI,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: msgs as any,
            stream: false,
        });

        const choice = response.choices[0];
        const msg = choice.message;

        if (msg.content) {
            onChunk(msg.content);
            finalText += msg.content;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        msgs.push(msg as any);

        if (choice.finish_reason === 'stop' || !msg.tool_calls?.length) {
            break;
        }

        for (const tc of msg.tool_calls) {
            // Narrow to function tool call — skip custom tool calls
            if (!('function' in tc)) { continue; }
            const ftc = tc as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
            let input: Record<string, string> = {};
            try { input = JSON.parse(ftc.function.arguments) as Record<string, string>; } catch { /* noop */ }
            onToolCall(ftc.function.name, input);
            const result = await executeTool(ftc.function.name, input, workspaceRoot);
            onToolResult(ftc.function.name, result);
            msgs.push({ role: 'tool', tool_call_id: ftc.id, content: result });
        }
    }

    // Return history without the system message
    return { reply: finalText, updatedHistory: msgs.slice(1) };
}

// ─── unified entry point ──────────────────────────────────────────────────────

export type StoredMessage =
    | ToolsBetaMessageParam
    | OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function runAgentLoop(
    key: string,
    systemPrompt: string,
    history: StoredMessage[],
    userText: string,
    userImages: string[],
    workspaceRoot: string,
    onChunk: (text: string) => void,
    onToolCall: (name: string, input: Record<string, string>) => void,
    onToolResult: (name: string, result: string) => void,
): Promise<{ reply: string; updatedHistory: StoredMessage[] }> {
    const provider = detectProvider(key);

    if (provider === 'anthropic') {
        // Build user content with optional images
        type ImgBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
        type TextBlock = { type: 'text'; text: string };
        let userContent: string | Array<ImgBlock | TextBlock>;
        if (userImages.length) {
            const blocks: Array<ImgBlock | TextBlock> = userImages.map(dataUrl => {
                const [meta, data] = dataUrl.split(',');
                const mediaType = meta.match(/image\/(jpeg|png|gif|webp)/)?.[0] ?? 'image/jpeg';
                return { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data } };
            });
            if (userText) { blocks.push({ type: 'text', text: userText }); }
            userContent = blocks;
        } else {
            userContent = userText;
        }

        const anthropicHistory = [...history as ToolsBetaMessageParam[]];
        if (userContent) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            anthropicHistory.push({ role: 'user', content: userContent as any });
        }

        const { reply, updatedHistory } = await runAgentLoopAnthropic(
            key, systemPrompt, anthropicHistory, workspaceRoot,
            onChunk, onToolCall, onToolResult,
        );
        return { reply, updatedHistory };
    } else {
        // Grok
        type GrokMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
        const grokHistory: GrokMsg[] = [...history as GrokMsg[]];

        if (userImages.length) {
            type ImgContent = Array<{ type: 'image_url'; image_url: { url: string; detail: 'high' } } | { type: 'text'; text: string }>;
            const parts: ImgContent = userImages.map(u => ({ type: 'image_url' as const, image_url: { url: u, detail: 'high' as const } }));
            if (userText) { parts.push({ type: 'text', text: userText }); }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            grokHistory.push({ role: 'user', content: parts as any });
        } else if (userText) {
            grokHistory.push({ role: 'user', content: userText });
        }

        const { reply, updatedHistory } = await runAgentLoopGrok(
            key, systemPrompt, grokHistory, workspaceRoot,
            onChunk, onToolCall, onToolResult,
        );
        return { reply, updatedHistory };
    }
}
