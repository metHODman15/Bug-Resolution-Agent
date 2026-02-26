import * as vscode from 'vscode';
import { ConversationMemory } from '../agent/memory/conversationMemory';
import { runAgentLoop, StoredMessage } from '../agent/tools/toolEngine';
import { isVsCodeLmAvailable, runVsCodeLmAgentLoop } from '../agent/tools/vscodeLmLoop';
import { ConfigWatcher } from '../agent/configWatcher';

/**
 * @agent chat participant — repo-driven white-label agent.
 *
 * Primary mode:  VS Code Language Model API (Copilot subscription).
 * Fallback mode: Direct Anthropic / Grok API key from secrets.
 */

export function registerParticipant(
    extCtx: vscode.ExtensionContext,
    configWatcher: ConfigWatcher,
): void {
    const memory = new ConversationMemory(extCtx);

    const participant = vscode.chat.createChatParticipant(
        'buildAgent.agent',
        async (
            request:  vscode.ChatRequest,
            _chatCtx: vscode.ChatContext,
            response: vscode.ChatResponseStream,
            token:    vscode.CancellationToken,
        ): Promise<vscode.ChatResult> => {

            // ── /reset ──────────────────────────────────────────────────────
            if (request.command === 'reset') {
                await memory.clear();
                response.markdown('🔄 **Session cleared.** Describe what to build next.');
                return {};
            }

            // ── Workspace gate ───────────────────────────────────────────────
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!wsRoot) {
                response.markdown('> ❌ Open a workspace folder first (File → Open Folder).');
                return {};
            }

            // ── Workspace trust gate ─────────────────────────────────────────
            if (!vscode.workspace.isTrusted) {
                response.markdown('> ⚠️ This workspace is not trusted. Agent actions are restricted.');
                return {};
            }

            // ── Load repo-driven config ──────────────────────────────────────
            const config = configWatcher.getConfig();

            // ── Primary: VS Code Language Model (Copilot) ────────────────────
            const hasVsCodeLm = await isVsCodeLmAvailable();
            if (hasVsCodeLm) {
                try {
                    await runVsCodeLmAgentLoop(
                        request.prompt,
                        response,
                        request.toolInvocationToken,
                        token,
                    );
                    return {
                        metadata: {
                            followups: [
                                { prompt: '/reset', label: '🔄 New session' },
                            ],
                        },
                    };
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    console.warn('Build Agent: VS Code LM failed, trying direct API —', msg);
                }
            }

            // ── Fallback: Direct API key ─────────────────────────────────────
            const apiKey = await extCtx.secrets.get('llm-api-key')
                ?? await extCtx.secrets.get('anthropic-api-key');
            if (!apiKey) {
                response.markdown(
                    '> ⚠️ **No language model available.**\n\n' +
                    'Install **GitHub Copilot** for seamless integration, or ' +
                    'configure an API key in VS Code secrets.\n',
                );
                return {};
            }

            const systemPrompt = config.systemPrompt +
                '\n\n**Workspace root:** `' + wsRoot + '`';
            const history = memory.load() as StoredMessage[];

            // ── Stream through direct-API agentic loop ───────────────────────
            try {
                const { updatedHistory } = await runAgentLoop(
                    apiKey,
                    systemPrompt,
                    history,
                    request.prompt,
                    [],
                    wsRoot,
                    (chunk) => {
                        response.markdown(chunk);
                    },
                    (name, input) => {
                        const label = name === 'write_file'
                            ? `Writing file: \`${String(input.path ?? '')}\``
                            : name === 'read_file'
                            ? `Reading: \`${String(input.path ?? '')}\``
                            : `Tool: ${name}`;
                        response.progress(label);
                    },
                    (_name, _result) => {
                        // tool result received
                    },
                );
                await memory.save(updatedHistory);
            } catch (e) {
                if (!token.isCancellationRequested) {
                    response.markdown(`\n\n> ❌ ${e instanceof Error ? e.message : String(e)}`);
                }
            }

            return {
                metadata: {
                    followups: [
                        { prompt: '/reset', label: '🔄 New session' },
                    ],
                },
            };
        },
    );

    participant.iconPath = new vscode.ThemeIcon('robot');

    participant.followupProvider = {
        provideFollowups(
            result:   vscode.ChatResult,
            _context: vscode.ChatContext,
            _token:   vscode.CancellationToken,
        ): vscode.ChatFollowup[] {
            return (result.metadata?.followups as vscode.ChatFollowup[] | undefined) ?? [];
        },
    };

    extCtx.subscriptions.push(participant);
}
