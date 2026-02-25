import * as vscode from 'vscode';
import { getSystemInstructions } from '../agent/instructions';
import { SfCliRunner } from '../agent/execution/sfCliRunner';
import { ConversationMemory } from '../agent/memory/conversationMemory';
import { runAgentLoop, StoredMessage } from '../agent/tools/toolEngine';
import { isVsCodeLmAvailable, runVsCodeLmAgentLoop } from '../agent/tools/vscodeLmLoop';

/**
 * @sfdebug chat participant — Copilot-native.
 *
 * Primary mode (like GitHub Copilot):
 *   Uses VS Code's Language Model API (`vscode.lm`) so the user's
 *   existing Copilot subscription provides the model — no separate
 *   API key is required.  Tools are invoked through `vscode.lm.invokeTool()`.
 *
 * Fallback mode:
 *   When no VS Code Language Model is available the participant falls
 *   back to a direct Anthropic / Grok API call (requires an API key
 *   stored in VS Code secrets).
 */

export function registerParticipant(extCtx: vscode.ExtensionContext): void {
    const memory = new ConversationMemory(extCtx);

    const participant = vscode.chat.createChatParticipant(
        'sfDebug.agent',
        async (
            request:  vscode.ChatRequest,
            _chatCtx: vscode.ChatContext,
            response: vscode.ChatResponseStream,
            token:    vscode.CancellationToken,
        ): Promise<vscode.ChatResult> => {

            // ── /reset ──────────────────────────────────────────────────────
            if (request.command === 'reset') {
                await memory.clear();
                response.markdown('🔄 **History cleared.** Describe your Salesforce issue to begin.');
                return {};
            }

            // ── Workspace gate ───────────────────────────────────────────────
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!wsRoot) {
                response.markdown('> ❌ Open a workspace folder first (File → Open Folder).');
                return {};
            }

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
                                { prompt: '/reset', label: '🔄 Clear history' },
                            ],
                        },
                    };
                } catch (e) {
                    // If the VS Code LM call fails, fall through to direct API
                    const msg = e instanceof Error ? e.message : String(e);
                    console.warn('SF Debug Agent: VS Code LM failed, trying direct API —', msg);
                }
            }

            // ── Fallback: Direct API key ─────────────────────────────────────
            const apiKey = await extCtx.secrets.get('llm-api-key')
                ?? await extCtx.secrets.get('anthropic-api-key');
            if (!apiKey) {
                response.markdown(
                    '> ⚠️ **No language model available.**\n\n' +
                    'Install **GitHub Copilot** for seamless integration, or ' +
                    'run **SF Debug: Configure API Key** from the Command Palette ' +
                    'to use a direct Anthropic / Grok key.\n',
                );
                response.button({ command: 'sfDebug.configureApiKey', title: '🔑 Configure API Key' });
                return {};
            }

            const orgAlias = await SfCliRunner.detectDefaultOrg();
            const orgLine  = orgAlias
                ? `\n\n**Connected Salesforce org:** \`${orgAlias}\` (auto-detected)\n**Workspace root:** \`${wsRoot}\``
                : `\n\n**Connected Salesforce org:** not detected\n**Workspace root:** \`${wsRoot}\``;

            const systemPrompt = getSystemInstructions() + orgLine;
            const history      = memory.load() as StoredMessage[];

            // ── Stream through direct-API agentic loop ───────────────────────

            try {
                const { updatedHistory } = await runAgentLoop(
                    apiKey,
                    systemPrompt,
                    history,
                    request.prompt,
                    [],          // no image support in chat participant API
                    wsRoot,
                    (chunk) => {
                        response.markdown(chunk);
                    },
                    (name, input) => {
                        const label = name === 'run_sf_command'
                            ? `Running SF CLI: \`${String(input.command ?? '').slice(0, 80)}\``
                            : name === 'write_file'
                            ? `Writing file: \`${String(input.path ?? '')}\``
                            : name === 'read_file'
                            ? `Reading: \`${String(input.path ?? '')}\``
                            : `Tool: ${name}`;
                        response.progress(label);
                    },
                    (_name, _result) => {
                        // tool result received — progress already shown via progress()
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
                        { prompt: '/reset', label: '🔄 Clear history' },
                    ],
                },
            };
        },
    );

    participant.iconPath = new vscode.ThemeIcon('bug');

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
