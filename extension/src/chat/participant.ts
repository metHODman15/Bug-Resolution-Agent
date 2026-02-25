import * as vscode from 'vscode';
import { getSystemInstructions } from '../agent/instructions';
import { SfCliRunner } from '../agent/execution/sfCliRunner';
import { ConversationMemory } from '../agent/memory/conversationMemory';
import { runAgentLoop, StoredMessage } from '../agent/tools/toolEngine';
import { detectProvider } from '../services/llmClient';

/**
 * @sfdebug chat participant  (requires GitHub Copilot Chat)
 *
 * Identical architecture to the webview panel:
 *   user message -> ConversationMemory.load() -> runAgentLoop() -> ConversationMemory.save()
 *
 * The participant stores per-workspace conversation history in ExtensionContext.workspaceState.
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

            // ── API key gate ────────────────────────────────────────────────
            const apiKey = await extCtx.secrets.get('llm-api-key')
                ?? await extCtx.secrets.get('anthropic-api-key');
            if (!apiKey) {
                response.markdown(
                    '> ⚠️ **No API key configured.**\n\n' +
                    'Run **SF Debug: Configure API Key** from the Command Palette.\n',
                );
                response.button({ command: 'sfDebug.configureApiKey', title: '🔑 Configure API Key' });
                return {};
            }

            // ── Workspace + org context ──────────────────────────────────────
            const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!wsRoot) {
                response.markdown('> ❌ Open a workspace folder first (File → Open Folder).');
                return {};
            }

            const orgAlias = await SfCliRunner.detectDefaultOrg();
            const orgLine  = orgAlias
                ? `\n\n**Connected Salesforce org:** \`${orgAlias}\` (auto-detected)\n**Workspace root:** \`${wsRoot}\``
                : `\n\n**Connected Salesforce org:** not detected\n**Workspace root:** \`${wsRoot}\``;

            const systemPrompt = getSystemInstructions() + orgLine;
            const history      = memory.load() as StoredMessage[];

            // ── Stream through agentic loop ──────────────────────────────────
            let fullText = '';

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
                        fullText += chunk;
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
