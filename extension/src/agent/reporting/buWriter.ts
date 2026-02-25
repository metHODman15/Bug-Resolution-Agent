import * as fs from 'fs';
import * as path from 'path';
import { InvestigationPlan, Finding, RootCauseAnalysis } from '../state';

/**
 * BU Writer - Generates business user-friendly reports
 * No technical jargon, focus on business impact and plain language
 */

export class BuWriter {
    async writeReport(
        reportDir: string,
        plan: InvestigationPlan,
        findings: Finding[],
        rootCause: RootCauseAnalysis
    ): Promise<void> {
        // Ensure directory exists
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const content = this.generateBuReport(plan, findings, rootCause);
        const filePath = path.join(reportDir, 'BU.md');
        
        fs.writeFileSync(filePath, content, 'utf8');
    }

    private generateBuReport(
        plan: InvestigationPlan,
        findings: Finding[],
        rootCause: RootCauseAnalysis
    ): string {
        const date = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        let report = `# Investigation Summary\n\n`;
        report += `**Date:** ${date}\n\n`;
        report += `**Object/Feature:** ${plan.context.impactedObject}\n\n`;
        report += `---\n\n`;

        // What happened section
        report += `## What Happened\n\n`;
        report += `${plan.context.symptom}\n\n`;
        
        if (plan.context.impactedUsers !== 'Not specified') {
            report += `**Affected Users:** ${plan.context.impactedUsers}\n\n`;
        }

        // What we found section
        report += `## What We Found\n\n`;
        report += this.translateRootCauseToPlainLanguage(rootCause);
        report += `\n\n`;

        // Why it happened section
        report += `## Why It Happened\n\n`;
        report += `${rootCause.explanation}\n\n`;

        // What needs to be done section
        report += `## What Needs to Be Done\n\n`;
        rootCause.recommendedActions.forEach((action, index) => {
            report += `${index + 1}. ${action}\n`;
        });
        report += `\n`;

        // Impact section
        report += `## Impact\n\n`;
        report += `**Records Affected:** ${rootCause.affectedRecords.length} record(s)\n\n`;
        report += `**Confidence Level:** ${this.formatConfidence(rootCause.confidence)}\n\n`;

        // Key findings in plain language
        if (findings.length > 0) {
            report += `## Key Points\n\n`;
            findings.slice(0, 5).forEach((finding, index) => {
                const plainLanguage = this.translateFindingToPlainLanguage(finding);
                if (plainLanguage) {
                    report += `${index + 1}. ${plainLanguage}\n`;
                }
            });
            report += `\n`;
        }

        report += `---\n\n`;
        report += `*This report was generated automatically based on system analysis.*\n`;

        return report;
    }

    private translateRootCauseToPlainLanguage(rootCause: RootCauseAnalysis): string {
        const causeMap: Record<string, string> = {
            'data': 'The issue is caused by incorrect or incomplete information entered into the system.',
            'system': 'The issue is caused by how the system is configured (automation rules, workflows, or settings).',
            'configuration': 'The issue is caused by system settings that need to be adjusted.',
            'permission': 'The issue is caused by access restrictions or permission settings.',
            'unknown': 'We need additional information to determine the exact cause.'
        };

        return causeMap[rootCause.primaryCause] || causeMap['unknown'];
    }

    private translateFindingToPlainLanguage(finding: Finding): string {
        // Convert technical findings to plain language
        const summary = finding.summary;
        
        // Remove technical terms
        const plain = summary
            .replace(/SOQL/gi, 'data query')
            .replace(/metadata/gi, 'system configuration')
            .replace(/validation rule/gi, 'data check')
            .replace(/workflow/gi, 'automatic process')
            .replace(/flow/gi, 'automatic process')
            .replace(/apex/gi, 'custom logic');

        return plain;
    }

    private formatConfidence(confidence: string): string {
        const map: Record<string, string> = {
            'high': 'We are very confident in this diagnosis ✓',
            'medium': 'We are reasonably confident in this diagnosis',
            'low': 'Additional investigation may be needed'
        };
        return map[confidence] || map['low'];
    }
}
