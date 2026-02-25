import Anthropic from '@anthropic-ai/sdk';
import { PlanStep, Finding, RootCauseAnalysis, InvestigationContext } from '../state';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { PathGuard } from '../safety/pathGuard';
import { ANALYSIS_INSTRUCTIONS } from '../instructions';
import { PromptBuilder, Snippet } from '../promptBuilder';
import { TokenTracker } from '../tokenTracker';

export class Analyzer {
    private client: Anthropic;
    private workspaceRoot: string;
    private promptBuilder: PromptBuilder;
    private tokenTracker: TokenTracker;

    constructor(apiKey: string, context: vscode.ExtensionContext, tokenTracker: TokenTracker) {
        this.client = new Anthropic({ apiKey });
        this.promptBuilder = new PromptBuilder(context);
        this.tokenTracker = tokenTracker;
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            throw new Error('No workspace folder open');
        }
        this.workspaceRoot = workspace.uri.fsPath;
    }

    async analyzeStepResult(step: PlanStep, result: string): Promise<Finding[]> {
        // Create snippet from step result
        const snippets: Snippet[] = [{
            id: `step-${step.id}`,
            content: `Step: ${step.description}\nResult: ${result}`,
            source: 'step-result'
        }];

        // Build bounded prompt
        const sessionSummary = `Analyzing step result for ${step.description}`;
        const prompt = this.promptBuilder.buildPrompt(
            sessionSummary,
            snippets,
            `Extract key findings from this step result.`,
            `step-${step.id}`
        );

        try {
            const message = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                system: ANALYSIS_INSTRUCTIONS,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const responseText = message.content[0].type === 'text' 
                ? message.content[0].text 
                : '';

            // Track token usage
            if (message.usage) {
                this.tokenTracker.addTokens(
                    message.usage.input_tokens,
                    message.usage.output_tokens
                );
            }

            const findings = this.parseFindingsFromResponse(responseText, step.id);
            
            // Save findings to file
            await this.saveFinding(findings);
            
            return findings;

        } catch (error) {
            console.error('Analysis failed:', error);
            // Return minimal finding on error
            return [{
                id: `finding-${step.id}`,
                type: 'data',
                summary: `Completed step: ${step.description}`,
                details: result.substring(0, 500),
                evidence: [],
                timestamp: new Date().toISOString()
            }];
        }
    }

    async determineRootCause(
        findings: Finding[],
        context: InvestigationContext
    ): Promise<RootCauseAnalysis> {
        // Check for resolution card
        const issueHash = this.promptBuilder.generateIssueHash(
            context.symptom,
            context.impactedObject,
            context.exampleRecords
        );
        
        const existingCard = this.promptBuilder.findResolutionCard(issueHash);
        if (existingCard && existingCard.confidence > 0.8) {
            return this.createRootCauseFromCard(existingCard);
        }

        // Create snippets from findings
        const snippets: Snippet[] = findings.map((f, i) => ({
            id: `finding-${i}`,
            content: `${f.type}: ${f.summary} - ${f.details}`,
            source: 'findings'
        }));

        // Build bounded prompt
        const sessionSummary = `Investigation of ${context.symptom} affecting ${context.impactedObject}`;
        const prompt = this.promptBuilder.buildPrompt(
            sessionSummary,
            snippets,
            `Determine root cause and provide detailed analysis including UI steps if needed.`,
            context.investigationId
        );

        try {
            const message = await this.client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                system: ANALYSIS_INSTRUCTIONS,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const responseText = message.content[0].type === 'text' 
                ? message.content[0].text 
                : '';

            // Track token usage
            if (message.usage) {
                this.tokenTracker.addTokens(
                    message.usage.input_tokens,
                    message.usage.output_tokens
                );
            }

            const rootCause = this.parseRootCauseFromResponse(responseText, context);
            
            // Store resolution card for future use
            const card = {
                issueHash,
                summary: rootCause.explanation,
                solution: rootCause.recommendedActions.join('; '),
                lastUsed: new Date().toISOString(),
                confidence: rootCause.confidence === 'high' ? 0.9 : rootCause.confidence === 'medium' ? 0.7 : 0.5
            };
            this.promptBuilder.storeResolutionCard(card);
            
            // Save root cause analysis
            await this.saveRootCauseAnalysis(rootCause);
            
            return rootCause;

        } catch (error) {
            console.error('Root cause determination failed:', error);
            // Return fallback analysis
            return this.createFallbackRootCause(context);
        }
    }

    private createRootCauseFromCard(card: { summary: string; solution: string }): RootCauseAnalysis {
        return {
            primaryCause: 'unknown',
            confidence: 'high',
            explanation: `Cached resolution: ${card.summary}`,
            affectedRecords: [],
            recommendedActions: [card.solution],
            uiActionPlan: undefined // Could be enhanced to store UI plans in cards
        };
    }

    private parseFindingsFromResponse(response: string, stepId: string): Finding[] {
        try {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found');
            }

            const findingsData = JSON.parse(jsonMatch[0]);
            
            return findingsData.map((finding: Record<string, unknown>, index: number) => ({
                id: `finding-${stepId}-${index + 1}`,
                type: (finding.type as string) || 'data',
                summary: (finding.summary as string) || 'Finding',
                details: (finding.details as string) || '',
                evidence: (finding.evidence as string[]) || [],
                timestamp: new Date().toISOString()
            }));

        } catch (error) {
            console.error('Failed to parse findings:', error);
            return [];
        }
    }

    private parseRootCauseFromResponse(
        response: string,
        context: InvestigationContext
    ): RootCauseAnalysis {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON object found');
            }

            const data = JSON.parse(jsonMatch[0]);
            
            return {
                primaryCause: data.primaryCause || 'unknown',
                confidence: data.confidence || 'low',
                explanation: data.explanation || 'Unable to determine root cause',
                affectedRecords: data.affectedRecords || context.exampleRecords,
                recommendedActions: data.recommendedActions || ['Review findings manually'],
                correctFieldValues: data.correctFieldValues,
                uiActionPlan: data.uiActionPlan
            };

        } catch (error) {
            console.error('Failed to parse root cause:', error);
            return this.createFallbackRootCause(context);
        }
    }

    private createFallbackRootCause(context: InvestigationContext): RootCauseAnalysis {
        return {
            primaryCause: 'unknown',
            confidence: 'low',
            explanation: 'Unable to automatically determine root cause. Manual review required.',
            affectedRecords: context.exampleRecords,
            recommendedActions: [
                'Review the generated findings manually',
                'Check automation logic in retrieved metadata',
                'Verify permissions and field-level security'
            ]
        };
    }

    private async saveFinding(findings: Finding[]): Promise<void> {
        const findingsDir = PathGuard.createSafePath('findings', this.workspaceRoot);
        
        for (const finding of findings) {
            const fileName = PathGuard.sanitizeFilename(`${finding.id}.json`);
            const filePath = path.join(findingsDir, fileName);
            
            fs.writeFileSync(filePath, JSON.stringify(finding, null, 2), 'utf8');
        }
    }

    private async saveRootCauseAnalysis(rootCause: RootCauseAnalysis): Promise<void> {
        const findingsDir = PathGuard.createSafePath('findings', this.workspaceRoot);
        const filePath = path.join(findingsDir, 'root-cause-analysis.json');
        
        fs.writeFileSync(filePath, JSON.stringify(rootCause, null, 2), 'utf8');
    }
}
