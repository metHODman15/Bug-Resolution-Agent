import * as vscode from 'vscode';
import { configureApiKeyCommand } from './commands/configureApiKey';
import { registerParticipant } from './chat/participant';
import { SfDebugWebviewProvider } from './chat/webviewProvider';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Salesforce Debug Agent activating…');

    // ── Primary UI: dedicated "SF Debug Agent" tab in the secondary sidebar ──
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

    // ── Keep the API-key command in the Command Palette ──────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('sfDebug.configureApiKey', async () => {
            await configureApiKeyCommand(context);
            // Refresh the webview panel so it hides the key banner immediately
            await webviewProvider.notifyKeyUpdated();
        }),
    );

    // ── Bonus: @sfdebug chat participant (requires GitHub Copilot Chat) ───────
    try {
        registerParticipant(context);
    } catch (err) {
        // vscode.chat may not be available — silently ignore
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('SF Debug Agent: chat participant not registered —', msg);
    }

    // ── First-run API key prompt ──────────────────────────────────────────────
    const hasApiKey = await context.secrets.get('llm-api-key')
        ?? await context.secrets.get('anthropic-api-key');
    if (!hasApiKey) {
        const action = await vscode.window.showInformationMessage(
            'SF Debug Agent: open the panel and enter your Anthropic or Grok API key to get started.',
            'Open SF Debug Agent',
            'Later',
        );
        if (action === 'Open SF Debug Agent') {
            await vscode.commands.executeCommand('sfDebug.chatView.focus');
        }
    }
}

export function deactivate() {
    // Nothing to clean up.
}
