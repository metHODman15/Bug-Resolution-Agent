import Anthropic from '@anthropic-ai/sdk';
import { InvestigationContext, InvestigationPlan, PlanStep } from './state';
import { SYSTEM_INSTRUCTIONS } from './instructions';
import { PromptBuilder } from './promptBuilder';
import * as vscode from 'vscode';
import { TokenTracker } from './tokenTracker';

export class Planner {
    private client: Anthropic;
    private promptBuilder: PromptBuilder;
    private tokenTracker: TokenTracker;

    constructor(apiKey: string, context: vscode.ExtensionContext, tokenTracker: TokenTracker) {
        this.client = new Anthropic({ apiKey });
        this.promptBuilder = new PromptBuilder(context);
        this.tokenTracker = tokenTracker;
    }

    async createPlan(context: InvestigationContext): Promise<InvestigationPlan> {
        // Check for resolution card first
        const issueHash = this.promptBuilder.generateIssueHash(
            context.symptom, 
            context.impactedObject, 
            context.exampleRecords
        );
        
        const existingCard = this.promptBuilder.findResolutionCard(issueHash);
        if (existingCard && existingCard.confidence > 0.8) {
            // Use cached resolution
            return this.createPlanFromCard(existingCard, context);
        }

        const prompt = this.buildPlanPrompt(context);

        const message = await this.client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: SYSTEM_INSTRUCTIONS,
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

        const steps = this.parseStepsFromResponse(responseText);

        return {
            id: context.investigationId,
            context,
            steps,
            approved: false,
            createdAt: new Date().toISOString()
        };
    }

    private createPlanFromCard(_card: { summary: string; solution: string }, context: InvestigationContext): InvestigationPlan {
        // Create a minimal plan based on cached resolution
        return {
            id: context.investigationId,
            context,
            steps: [{
                id: 'cached-resolution',
                type: 'analysis',
                description: 'Using cached resolution for similar issue',
                status: 'completed'
            }],
            approved: true, // Auto-approve cached resolutions
            createdAt: new Date().toISOString()
        };
    }

    private buildPlanPrompt(context: InvestigationContext): string {
        return `Create an investigation plan for the following Salesforce issue:

Org: ${context.orgAlias}
Symptom: ${context.symptom}
Impacted Object/Feature: ${context.impactedObject}
Impacted Users: ${context.impactedUsers}
Example Records: ${context.exampleRecords.join(', ')}

Generate a step-by-step investigation plan using ONLY read-only operations.
Focus on:
1. Querying the example records and related data
2. Retrieving relevant automation metadata (flows, workflows, validation rules)
3. Checking permissions if needed
4. Understanding the expected vs actual behavior

Return the plan as a JSON array of steps. Each step should have:
- type: "query" | "retrieve" | "apex" | "analysis"
- description: Clear description of what this step does
- command: (optional) The exact CLI command to run
- filePath: (optional) Path to the script file if needed

Example:
[
  {
    "type": "query",
    "description": "Query example records to see current field values",
    "command": "sf data query --file scripts/soql/query_records.soql --json -o ${context.orgAlias}",
    "filePath": "runtime/scripts/soql/query_records.soql"
  }
]`;
    }

    private parseStepsFromResponse(response: string): PlanStep[] {
        try {
            // Extract JSON from response (might be wrapped in markdown code blocks)
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }

            const stepsData = JSON.parse(jsonMatch[0]);
            
            return stepsData.map((step: Record<string, unknown>, index: number) => ({
                id: `step-${index + 1}`,
                type: (step.type as string) || 'analysis',
                description: (step.description as string) || 'Investigation step',
                command: step.command as string | undefined,
                filePath: step.filePath as string | undefined,
                status: 'pending' as const
            }));

        } catch (error) {
            // Fallback to default plan if parsing fails
            console.error('Failed to parse plan from AI response:', error);
            return this.createFallbackPlan();
        }
    }

    private createFallbackPlan(): PlanStep[] {
        return [
            {
                id: 'step-1',
                type: 'query',
                description: 'Query example records to examine current state',
                status: 'pending'
            },
            {
                id: 'step-2',
                type: 'retrieve',
                description: 'Retrieve relevant metadata for analysis',
                status: 'pending'
            },
            {
                id: 'step-3',
                type: 'analysis',
                description: 'Analyze findings to determine root cause',
                status: 'pending'
            }
        ];
    }
}
