import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface Snippet {
    id: string;
    content: string;
    source: string;
}

export interface ResolutionCard {
    issueHash: string;
    summary: string;
    solution: string;
    lastUsed: string;
    confidence: number;
}

export class PromptBuilder {
    private context: vscode.ExtensionContext;
    private resolutionCards: Map<string, ResolutionCard> = new Map();
    private summaries: Map<string, { short: string; long: string }> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadResolutionCards();
    }

    /**
     * Builds bounded prompt for LLM calls
     * Hard limits: summary_short <=600 chars, up to 5 snippets <=450 chars each
     */
    buildPrompt(
        sessionSummary: string,
        snippets: Snippet[],
        lastMessage: string,
        investigationId: string
    ): string {
        // Get or create cached summary
        const cached = this.summaries.get(investigationId);
        const summaryShort = cached?.short || this.createSummaryShort(sessionSummary);

        // Cache if not exists
        if (!cached) {
            this.summaries.set(investigationId, {
                short: summaryShort,
                long: this.createSummaryLong(sessionSummary)
            });
        }

        // Select up to 5 most relevant snippets, truncated to 450 chars each
        const selectedSnippets = snippets.slice(0, 5).map(s => ({
            ...s,
            content: s.content.substring(0, 450)
        }));

        // Build prompt with IDs instead of full content where possible
        const snippetRefs = selectedSnippets.map(s => `Snippet ${s.id}: ${s.content}`).join('\n\n');

        return `Session Summary (${summaryShort.length} chars): ${summaryShort}

Relevant Snippets:
${snippetRefs}

Last User Message: ${lastMessage}`;
    }

    /**
     * Creates short summary <=600 chars
     */
    private createSummaryShort(text: string): string {
        if (text.length <= 600) {return text;}
        return text.substring(0, 597) + '...';
    }

    /**
     * Creates long summary <=2000 chars
     */
    private createSummaryLong(text: string): string {
        if (text.length <= 2000) {return text;}
        return text.substring(0, 1997) + '...';
    }

    /**
     * Checks for existing resolution card
     */
    findResolutionCard(issueHash: string): ResolutionCard | undefined {
        return this.resolutionCards.get(issueHash);
    }

    /**
     * Stores resolution card for future reuse
     */
    storeResolutionCard(card: ResolutionCard): void {
        this.resolutionCards.set(card.issueHash, card);
        this.saveResolutionCards();
    }

    /**
     * Generates hash for issue fingerprinting
     */
    generateIssueHash(symptom: string, object: string, records: string[]): string {
        const fingerprint = `${symptom.toLowerCase()}-${object.toLowerCase()}-${records.sort().join(',')}`;
        // Simple hash for demo - in production use crypto
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString();
    }

    private loadResolutionCards(): void {
        try {
            const cardsPath = path.join(this.context.globalStorageUri.fsPath, 'resolution-cards.json');
            if (fs.existsSync(cardsPath)) {
                const data = fs.readFileSync(cardsPath, 'utf8');
                const cards = JSON.parse(data);
                this.resolutionCards = new Map(Object.entries(cards));
            }
        } catch (error) {
            console.warn('Failed to load resolution cards:', error);
        }
    }

    private saveResolutionCards(): void {
        try {
            const cardsPath = path.join(this.context.globalStorageUri.fsPath, 'resolution-cards.json');
            const cardsObj = Object.fromEntries(this.resolutionCards);
            fs.writeFileSync(cardsPath, JSON.stringify(cardsObj, null, 2));
        } catch (error) {
            console.warn('Failed to save resolution cards:', error);
        }
    }
}