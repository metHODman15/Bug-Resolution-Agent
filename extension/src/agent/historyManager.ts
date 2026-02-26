/**
 * History Manager — enforces the "2 past conversation previews" rule.
 *
 * Rules:
 *  - Only 2 past conversation previews are stored (title + timestamp + snippet).
 *  - Previews are NOT clickable, NOT resumable, NOT openable.
 *  - Current chat is ephemeral: on reload → fresh chat, but previews persist.
 *  - When a new chat starts, older previews rotate (FIFO, max 2).
 *  - Full logs are NOT exposed to the UI.
 */

import * as vscode from 'vscode';

const MAX_PREVIEWS = 2;
const PREVIEWS_KEY = 'agent-chat-previews';
const SNIPPET_LENGTH = 80;

export interface ConversationPreview {
    /** Short title derived from first user message. */
    title: string;
    /** ISO timestamp of conversation start. */
    timestamp: string;
    /** Truncated snippet of first assistant response. */
    snippet: string;
}

export class HistoryManager {
    constructor(private readonly ctx: vscode.ExtensionContext) {}

    /** Get stored previews (max 2, most recent first). */
    getPreviews(): ConversationPreview[] {
        return this.ctx.workspaceState.get<ConversationPreview[]>(PREVIEWS_KEY) ?? [];
    }

    /**
     * Archive the current session into a preview and rotate.
     * Call this when a new chat is started (not on every message).
     *
     * @param firstUserMessage  The first user message of the session being archived.
     * @param firstAssistantMsg The first assistant response snippet.
     */
    async archiveSession(
        firstUserMessage: string,
        firstAssistantMsg: string,
    ): Promise<void> {
        const preview: ConversationPreview = {
            title: truncate(firstUserMessage, 60),
            timestamp: new Date().toISOString(),
            snippet: truncate(firstAssistantMsg, SNIPPET_LENGTH),
        };

        const existing = this.getPreviews();
        // Prepend new, keep max 2
        const updated = [preview, ...existing].slice(0, MAX_PREVIEWS);
        await this.ctx.workspaceState.update(PREVIEWS_KEY, updated);
    }

    /** Clear all previews. */
    async clear(): Promise<void> {
        await this.ctx.workspaceState.update(PREVIEWS_KEY, []);
    }
}

function truncate(text: string, maxLen: number): string {
    const clean = text.replace(/\n/g, ' ').trim();
    return clean.length > maxLen ? clean.slice(0, maxLen) + '…' : clean;
}
