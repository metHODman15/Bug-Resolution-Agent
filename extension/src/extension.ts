import * as vscode from 'vscode';
import { registerParticipant } from './chat/participant';
import { AgentWebviewProvider } from './chat/webviewProvider';
import {
    WriteFileTool,
    ReadFileTool,
    ListDirTool,
} from './agent/tools/chatTools';
import { isVsCodeLmAvailable } from './agent/tools/vscodeLmLoop';
import { ConfigWatcher } from './agent/configWatcher';
import { HistoryManager } from './agent/historyManager';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Build Agent activating…');

    // ── Config watcher (repo-driven markdown) ────────────────────────────────
    const configWatcher = new ConfigWatcher();
    context.subscriptions.push(configWatcher);
    const config = configWatcher.load();

    // Log parse warnings (dev-only, never exposed to UI)
    for (const w of config.agentsParseResult.warnings) {
        console.warn('AGENTS.md:', w);
    }
    for (const w of config.instructionsParseResult.warnings) {
        console.warn('copilot-instructions.md:', w);
    }

    // ── History manager (2-preview rotation) ─────────────────────────────────
    const historyManager = new HistoryManager(context);

    // ── Register Language Model Tools ────────────────────────────────────────
    context.subscriptions.push(
        vscode.lm.registerTool('buildAgent_writeFile', new WriteFileTool()),
        vscode.lm.registerTool('buildAgent_readFile', new ReadFileTool()),
        vscode.lm.registerTool('buildAgent_listDir', new ListDirTool()),
    );

    // ── Primary UI: @agent chat participant ──────────────────────────────────
    try {
        registerParticipant(context, configWatcher);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('Build Agent: chat participant not registered —', msg);
    }

    // ── Secondary UI: sidebar webview ────────────────────────────────────────
    const webviewProvider = new AgentWebviewProvider(
        context.extensionUri,
        context,
        configWatcher,
        historyManager,
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            AgentWebviewProvider.viewType,
            webviewProvider,
            { webviewOptions: { retainContextWhenHidden: true } },
        ),
    );

    // ── Commands ─────────────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('buildAgent.newChat', () => {
            webviewProvider.startNewChat();
        }),
        vscode.commands.registerCommand('buildAgent.generateTemplates', async () => {
            const { agentsExists, instructionsExists } = configWatcher.filesExist();
            if (agentsExists && instructionsExists) {
                vscode.window.showInformationMessage(
                    'Agent instructions are managed by your organization.',
                );
                return;
            }
            const created = await configWatcher.generateTemplates();
            if (created) {
                vscode.window.showInformationMessage(
                    'Generated .github/AGENTS.md and .github/copilot-instructions.md templates.',
                );
            }
        }),
    );

    // ── Workspace trust gate ─────────────────────────────────────────────────
    if (!vscode.workspace.isTrusted) {
        console.warn('Build Agent: workspace is not trusted — agent actions are restricted.');
    }

    // ── LM availability check (informational only) ───────────────────────────
    const hasLm = await isVsCodeLmAvailable();
    if (hasLm) {
        console.log('Build Agent: VS Code Language Model detected.');
    }
}

export function deactivate() {
    // Nothing to clean up.
}
