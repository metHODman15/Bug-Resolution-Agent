/**
 * Conversation memory — persists the rolling chat history per workspace.
 *
 * Storage key: `chat-history-<workspaceFsPath-hash>`
 * Stored in vscode.ExtensionContext.workspaceState so it's scoped to each
 * workspace automatically (VS Code isolates workspaceState per workspace).
 *
 * Max messages kept: HISTORY_LIMIT (rolling window) to avoid context overflow.
 */

import * as vscode from 'vscode';
import type { StoredMessage } from '../tools/toolEngine';

const HISTORY_LIMIT = 80; // keep last ~80 message entries (user+assistant pairs)
const STORAGE_KEY   = 'sf-debug-chat-history';

export class ConversationMemory {
    constructor(private readonly _ctx: vscode.ExtensionContext) {}

    /** Load full history for the current workspace. */
    load(): StoredMessage[] {
        return this._ctx.workspaceState.get<StoredMessage[]>(STORAGE_KEY) ?? [];
    }

    /** Persist history, trimming to HISTORY_LIMIT. */
    async save(history: StoredMessage[]): Promise<void> {
        const trimmed = history.length > HISTORY_LIMIT
            ? history.slice(history.length - HISTORY_LIMIT)
            : history;
        await this._ctx.workspaceState.update(STORAGE_KEY, trimmed);
    }

    /** Wipe history for this workspace. */
    async clear(): Promise<void> {
        await this._ctx.workspaceState.update(STORAGE_KEY, []);
    }

    /** How many messages are stored. */
    count(): number {
        return this.load().length;
    }
}
