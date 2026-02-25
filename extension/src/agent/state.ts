import * as vscode from 'vscode';
import { TokenTracker } from './tokenTracker';

export interface InvestigationContext {
    orgAlias: string;
    symptom: string;
    impactedObject: string;
    impactedUsers: string;
    exampleRecords: string[];
    timestamp: string;
    investigationId: string;
}

export interface InvestigationPlan {
    id: string;
    context: InvestigationContext;
    steps: PlanStep[];
    approved: boolean;
    createdAt: string;
    analysis?: unknown;
    tokenUsage?: unknown;
}

export interface PlanStep {
    id: string;
    type: 'query' | 'retrieve' | 'apex' | 'analysis';
    description: string;
    command?: string;
    filePath?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    output?: string;
}

export interface Finding {
    id: string;
    type: 'data' | 'metadata' | 'permission' | 'automation' | 'web-research';
    summary: string;
    details: string;
    evidence: string[];
    timestamp: string;
}

export interface RootCauseAnalysis {
    primaryCause: 'data' | 'system' | 'configuration' | 'permission' | 'unknown';
    confidence: 'high' | 'medium' | 'low';
    explanation: string;
    affectedRecords: string[];
    recommendedActions: string[];
    correctFieldValues?: Record<string, unknown>;
    uiActionPlan?: UiActionPlan;
}
export interface UiActionPlan {
    targetUi: string;
    steps: string[];
    verification: string[];
}

export interface AnalysisResult {
    plan?: InvestigationPlan;
    answer_markdown: string;
    cited_ids: string[];
    ui_action_plan?: UiActionPlan;
    followups: string[];
}

export class InvestigationState {
    private context: vscode.ExtensionContext;
    private currentPlan?: InvestigationPlan;
    private findings: Finding[] = [];
    private rootCause?: RootCauseAnalysis;
    private retryCount: number = 0;
    private tokenTracker: TokenTracker;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.tokenTracker = new TokenTracker();
    }

    setCurrentPlan(plan: InvestigationPlan) {
        this.currentPlan = plan;
    }

    getCurrentPlan(): InvestigationPlan | undefined {
        return this.currentPlan;
    }

    addFinding(finding: Finding) {
        this.findings.push(finding);
    }

    getFindings(): Finding[] {
        return this.findings;
    }

    setRootCause(analysis: RootCauseAnalysis) {
        this.rootCause = analysis;
    }

    getRootCause(): RootCauseAnalysis | undefined {
        return this.rootCause;
    }

    incrementRetry(): number {
        return ++this.retryCount;
    }

    getRetryCount(): number {
        return this.retryCount;
    }

    reset() {
        this.currentPlan = undefined;
        this.findings = [];
        this.rootCause = undefined;
        this.retryCount = 0;
        this.tokenTracker.reset();
    }

    getContext(): vscode.ExtensionContext {
        return this.context;
    }

    getTokenTracker(): TokenTracker {
        return this.tokenTracker;
    }
}
