import * as vscode from 'vscode';

export async function configureApiKeyCommand(context: vscode.ExtensionContext): Promise<void> {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Anthropic key (sk-ant-…) or Grok/xAI key (xai-…)',
        password: true,
        placeHolder: 'sk-ant-... or xai-...',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
            }
            if (!value.startsWith('sk-ant-') && !value.startsWith('xai-')) {
                return 'Key must start with sk-ant- (Anthropic) or xai- (Grok)';
            }
            return null;
        }
    });

    if (apiKey) {
        await context.secrets.store('llm-api-key', apiKey);
        const provider = apiKey.startsWith('xai-') ? 'Grok' : 'Anthropic';
        vscode.window.showInformationMessage(`${provider} API key configured successfully`);
    }
}
