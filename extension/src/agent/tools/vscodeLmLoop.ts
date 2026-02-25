/**
 * Agentic loop using VS Code's native Language Model API.
 *
 * This replaces direct Anthropic/Grok API calls with `vscode.lm.selectChatModels()`
 * so the extension works like GitHub Copilot — users do NOT need a separate API key;
 * any model available through their VS Code installation (e.g. Copilot subscription)
 * is used automatically.
 *
 * Tool calls are executed via `vscode.lm.invokeTool()`, which uses tools registered
 * with `vscode.lm.registerTool()` (see chatTools.ts).
 */

import * as vscode from 'vscode';
import { getSystemInstructions } from '../instructions';
import { SfCliRunner } from '../execution/sfCliRunner';

const MAX_ITERATIONS = 20;

/**
 * Returns true if at least one VS Code Language Model is available.
 */
export async function isVsCodeLmAvailable(): Promise<boolean> {
    try {
        const models = await vscode.lm.selectChatModels();
        return models.length > 0;
    } catch {
        return false;
    }
}

/**
 * Run the agentic investigation loop using VS Code's Language Model API.
 *
 * @param userText    The user's plain-English problem description.
 * @param response    The `ChatResponseStream` from the chat participant handler.
 * @param toolToken   Tool invocation token from the chat request (for UI progress).
 * @param token       Cancellation token.
 */
export async function runVsCodeLmAgentLoop(
    userText: string,
    response: vscode.ChatResponseStream,
    toolToken: vscode.ChatParticipantToolToken | undefined,
    token: vscode.CancellationToken,
): Promise<void> {
    // ── Select best available model ──────────────────────────────────────
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (!models.length) {
        // Fall back to any available model
        const allModels = await vscode.lm.selectChatModels();
        if (!allModels.length) {
            throw new Error(
                'No language model available. Install GitHub Copilot or configure an API key.',
            );
        }
        models.push(allModels[0]);
    }
    const model = models[0];

    // ── Build context ────────────────────────────────────────────────────
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const orgAlias = await SfCliRunner.detectDefaultOrg();
    const orgLine = orgAlias
        ? `\n\n**Connected Salesforce org:** \`${orgAlias}\` (auto-detected)\n**Workspace root:** \`${wsRoot}\``
        : `\n\n**Connected Salesforce org:** not detected\n**Workspace root:** \`${wsRoot}\``;

    const systemPrompt = getSystemInstructions() + orgLine;

    // ── Collect registered sfDebug tools ──────────────────────────────────
    const tools: vscode.LanguageModelChatTool[] = vscode.lm.tools
        .filter((t) => t.name.startsWith('sfDebug_'))
        .map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        }));

    // ── Build initial messages ───────────────────────────────────────────
    const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        vscode.LanguageModelChatMessage.User(userText),
    ];

    // ── Agentic loop ─────────────────────────────────────────────────────
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (token.isCancellationRequested) { break; }

        const chatResponse = await model.sendRequest(
            messages,
            {
                tools: tools.length > 0 ? tools : undefined,
                toolMode: vscode.LanguageModelChatToolMode.Auto,
            },
            token,
        );

        // Process the response stream
        const toolCalls: vscode.LanguageModelToolCallPart[] = [];
        const textParts: vscode.LanguageModelTextPart[] = [];

        for await (const part of chatResponse.stream) {
            if (part instanceof vscode.LanguageModelTextPart) {
                response.markdown(part.value);
                textParts.push(part);
            } else if (part instanceof vscode.LanguageModelToolCallPart) {
                toolCalls.push(part);
            }
        }

        // No tool calls → model is done
        if (toolCalls.length === 0) { break; }

        // Append assistant message (text + tool calls)
        const assistantContent: Array<vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart> = [
            ...textParts,
            ...toolCalls,
        ];
        messages.push(
            vscode.LanguageModelChatMessage.Assistant(assistantContent),
        );

        // Execute each tool and collect results
        const resultParts: vscode.LanguageModelToolResultPart[] = [];
        for (const tc of toolCalls) {
            response.progress(`Calling ${tc.name.replace('sfDebug_', '')}…`);
            try {
                const result = await vscode.lm.invokeTool(
                    tc.name,
                    { input: tc.input, toolInvocationToken: toolToken },
                    token,
                );
                resultParts.push(
                    new vscode.LanguageModelToolResultPart(tc.callId, result.content),
                );
            } catch (err) {
                resultParts.push(
                    new vscode.LanguageModelToolResultPart(tc.callId, [
                        new vscode.LanguageModelTextPart(
                            `ERROR: ${err instanceof Error ? err.message : String(err)}`,
                        ),
                    ]),
                );
            }
        }

        // Feed tool results back as a User message
        messages.push(
            vscode.LanguageModelChatMessage.User(resultParts),
        );
    }
}
