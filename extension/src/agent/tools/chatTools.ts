/**
 * VS Code Language Model Tool implementations.
 *
 * These tools are registered via `vscode.lm.registerTool()` so that any
 * VS Code Language Model (including GitHub Copilot) can invoke them
 * directly — no separate API key required.
 *
 * Each tool mirrors the corresponding function in toolEngine.ts but
 * implements the `vscode.LanguageModelTool<T>` interface for native
 * VS Code integration.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CliAllowlist } from '../safety/cliAllowlist';
import { PathGuard } from '../safety/pathGuard';

const execAsync = promisify(exec);

function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

// ─── Run SF Command ──────────────────────────────────────────────────────────

interface RunSfCommandInput {
    command: string;
}

export class RunSfCommandTool implements vscode.LanguageModelTool<RunSfCommandInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<RunSfCommandInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { command } = options.input;
        const wsRoot = getWorkspaceRoot();
        if (!wsRoot) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('ERROR: No workspace folder open.'),
            ]);
        }

        if (!CliAllowlist.isCommandAllowed(command)) {
            const reason = CliAllowlist.getReasonForRejection(command);
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`BLOCKED: ${reason}`),
            ]);
        }

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: wsRoot,
                timeout: 60_000,
            });
            const result =
                (stdout || '(no output)') +
                (stderr ? `\nSTDERR: ${stderr}` : '');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(result),
            ]);
        } catch (err: unknown) {
            const e = err as { stdout?: string; stderr?: string; message?: string };
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(
                    `COMMAND ERROR: ${e.message ?? ''}\nSTDOUT: ${e.stdout ?? ''}\nSTDERR: ${e.stderr ?? ''}`,
                ),
            ]);
        }
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<RunSfCommandInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        const cmd = options.input.command;
        if (!CliAllowlist.isCommandAllowed(cmd)) {
            return {
                invocationMessage: `SF CLI command blocked`,
                confirmationMessages: {
                    title: 'Command Not Allowed',
                    message: `This command is not in the read-only allowlist:\n\`${cmd}\``,
                },
            };
        }
        return {
            invocationMessage: `Running SF CLI: \`${cmd.slice(0, 80)}\``,
        };
    }
}

// ─── Write File ──────────────────────────────────────────────────────────────

interface WriteFileInput {
    path: string;
    content: string;
}

export class WriteFileTool implements vscode.LanguageModelTool<WriteFileInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<WriteFileInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const wsRoot = getWorkspaceRoot();
        if (!wsRoot) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('ERROR: No workspace folder open.'),
            ]);
        }

        const abs = path.isAbsolute(options.input.path)
            ? options.input.path
            : path.join(wsRoot, options.input.path);

        if (!PathGuard.isWriteAllowed(abs, wsRoot)) {
            const reason = PathGuard.getReasonForRejection(abs, wsRoot, 'write');
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`BLOCKED (write): ${reason}`),
            ]);
        }

        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, options.input.content, 'utf8');
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
                `Written: ${options.input.path} (${options.input.content.length} bytes)`,
            ),
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<WriteFileInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Writing file: \`${options.input.path}\``,
            confirmationMessages: {
                title: 'Write File',
                message: `Allow writing to \`${options.input.path}\`?`,
            },
        };
    }
}

// ─── Read File ───────────────────────────────────────────────────────────────

interface ReadFileInput {
    path: string;
}

export class ReadFileTool implements vscode.LanguageModelTool<ReadFileInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ReadFileInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const wsRoot = getWorkspaceRoot();
        if (!wsRoot) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('ERROR: No workspace folder open.'),
            ]);
        }

        const abs = path.isAbsolute(options.input.path)
            ? options.input.path
            : path.join(wsRoot, options.input.path);

        if (!PathGuard.isReadAllowed(abs, wsRoot)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('BLOCKED (read): path not allowed'),
            ]);
        }

        if (!fs.existsSync(abs)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`NOT FOUND: ${options.input.path}`),
            ]);
        }

        const content = fs.readFileSync(abs, 'utf8');
        const result =
            content.length > 15_000
                ? content.slice(0, 15_000) + '\n...[truncated]'
                : content;
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result),
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ReadFileInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Reading: \`${options.input.path}\``,
        };
    }
}

// ─── List Directory ──────────────────────────────────────────────────────────

interface ListDirInput {
    path: string;
}

export class ListDirTool implements vscode.LanguageModelTool<ListDirInput> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ListDirInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const wsRoot = getWorkspaceRoot();
        if (!wsRoot) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('ERROR: No workspace folder open.'),
            ]);
        }

        const abs = path.isAbsolute(options.input.path)
            ? options.input.path
            : path.join(wsRoot, options.input.path);

        if (!fs.existsSync(abs)) {
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(`NOT FOUND: ${options.input.path}`),
            ]);
        }

        const entries = fs.readdirSync(abs, { withFileTypes: true });
        const result =
            entries
                .map((e) => (e.isDirectory() ? e.name + '/' : e.name))
                .join('\n') || '(empty)';
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result),
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ListDirInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: `Listing: \`${options.input.path}\``,
        };
    }
}
