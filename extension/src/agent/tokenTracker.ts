import * as vscode from 'vscode';

/**
 * TokenTracker - Tracks token usage for conversation sessions
 * Accumulates input and output tokens across all LLM calls in a session
 */
export class TokenTracker {
    private totalTokens: number = 0;
    private webview?: vscode.Webview;

    constructor() {
        this.reset();
    }

    /**
     * Add tokens from an LLM call
     * @param inputTokens Number of input/prompt tokens
     * @param outputTokens Number of output/response tokens
     */
    addTokens(inputTokens: number, outputTokens: number): void {
        if (inputTokens < 0 || outputTokens < 0) {
            throw new Error('Token counts cannot be negative');
        }

        this.totalTokens += inputTokens + outputTokens;
        this.notifyWebview();
    }

    /**
     * Get the current total token count
     */
    getTotal(): number {
        return this.totalTokens;
    }

    /**
     * Reset the token counter for a new session
     */
    reset(): void {
        this.totalTokens = 0;
        this.notifyWebview();
    }

    /**
     * Set the webview reference for sending updates
     */
    setWebview(webview: vscode.Webview): void {
        this.webview = webview;
        // Send current total to initialize the UI
        this.notifyWebview();
    }

    /**
     * Send token update to the webview
     */
    private notifyWebview(): void {
        if (this.webview) {
            this.webview.postMessage({
                type: 'tokenUpdate',
                totalTokens: this.totalTokens
            });
        }
    }
}