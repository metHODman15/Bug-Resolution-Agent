import * as vscode from 'vscode';
import { configureApiKeyCommand } from './commands/configureApiKey';
import { registerParticipant } from './chat/participant';
import { SfDebugWebviewProvider } from './chat/webviewProvider';
import {
    RunSfCommandTool,
    WriteFileTool,
    ReadFileTool,
    ListDirTool,
} from './agent/tools/chatTools';
import { isVsCodeLmAvailable } from './agent/tools/vscodeLmLoop';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Salesforce Debug Agent activating…');

    // ── Register Language Model Tools (Copilot-native) ───────────────────────
    // These tools become available to any VS Code Language Model (including
    // GitHub Copilot) so the agent can run SF CLI commands, read/write files,
    // and list directories — all without a separate API key.
    context.subscriptions.push(
        vscode.lm.registerTool('sfDebug_runSfCommand', new RunSfCommandTool()),
        vscode.lm.registerTool('sfDebug_writeFile', new WriteFileTool()),
        vscode.lm.registerTool('sfDebug_readFile', new ReadFileTool()),
        vscode.lm.registerTool('sfDebug_listDir', new ListDirTool()),
    );

    // ── Primary UI: @sfdebug chat participant (like GitHub Copilot) ──────────
    try {
        registerParticipant(context);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('SF Debug Agent: chat participant not registered —', msg);
    }

    // ── Secondary UI: sidebar webview (fallback for non-Copilot users) ───────
    const webviewProvider = new SfDebugWebviewProvider(
        context.extensionUri,
        context,
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SfDebugWebviewProvider.viewType,
            webviewProvider,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );

    // ── API-key command (Command Palette) ────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('sfDebug.configureApiKey', async () => {
            await configureApiKeyCommand(context);
            await webviewProvider.notifyKeyUpdated();
        }),
    );

    // ── First-run guidance ───────────────────────────────────────────────────
    // If VS Code LM is available (Copilot), skip the API key prompt entirely.
    const hasLm = await isVsCodeLmAvailable();
    if (hasLm) {
        console.log('SF Debug Agent: VS Code Language Model detected — using Copilot.');
        return;
    }

    // No Copilot — check for a direct API key
    const hasApiKey = await context.secrets.get('llm-api-key')
        ?? await context.secrets.get('anthropic-api-key');
    if (!hasApiKey) {
        const action = await vscode.window.showInformationMessage(
            'SF Debug Agent: install GitHub Copilot for the best experience, or enter an Anthropic / Grok API key.',
            'Open @sfdebug Chat',
            'Configure API Key',
            'Later',
        );
        if (action === 'Open @sfdebug Chat') {
            await vscode.commands.executeCommand('workbench.action.chat.open');
        } else if (action === 'Configure API Key') {
            await vscode.commands.executeCommand('sfDebug.configureApiKey');
        }
    }
}

export function deactivate() {
    // Nothing to clean up.
}
