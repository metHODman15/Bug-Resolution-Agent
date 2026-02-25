import * as fs from 'fs';
import * as path from 'path';
import { InvestigationPlan, Finding, RootCauseAnalysis } from '../state';

/**
 * Tech Writer - Generates detailed technical documentation
 * Includes all evidence, queries, metadata analysis, and technical details
 */

export class TechWriter {
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

        const content = this.generateTechReport(plan, findings, rootCause);
        const filePath = path.join(reportDir, 'Tech Document.md');
        
        fs.writeFileSync(filePath, content, 'utf8');
    }

    private generateTechReport(
        plan: InvestigationPlan,
        findings: Finding[],
        rootCause: RootCauseAnalysis
    ): string {
        const date = new Date().toISOString();

        let report = `# Technical Investigation Report\n\n`;
        report += `**Investigation ID:** ${plan.id}\n\n`;
        report += `**Timestamp:** ${date}\n\n`;
        report += `**Org Alias:** ${plan.context.orgAlias}\n\n`;
        report += `---\n\n`;

        // Investigation context
        report += `## Investigation Context\n\n`;
        report += `**Symptom:** ${plan.context.symptom}\n\n`;
        report += `**Impacted Object/Feature:** ${plan.context.impactedObject}\n\n`;
        report += `**Impacted Users/Profiles:** ${plan.context.impactedUsers}\n\n`;
        report += `**Example Records:**\n`;
        plan.context.exampleRecords.forEach(record => {
            // Extract record ID if it's a URL
            const recordId = this.extractRecordId(record);
            if (recordId) {
                report += `- ${recordId} (${record})\n`;
            } else {
                report += `- ${record}\n`;
            }
        });
        report += `\n`;

        // Investigation plan executed
        report += `## Investigation Plan Executed\n\n`;
        plan.steps.forEach((step, index) => {
            report += `### Step ${index + 1}: ${step.description}\n\n`;
            report += `- **Type:** ${step.type}\n`;
            report += `- **Status:** ${step.status}\n`;
            if (step.command) {
                report += `- **Command:** \`${step.command}\`\n`;
            }
            if (step.filePath) {
                report += `- **Script File:** \`${step.filePath}\`\n`;
            }
            report += `\n`;
        });

        // Findings by category
        report += `## Findings\n\n`;
        const findingsByType = this.groupFindingsByType(findings);
        
        for (const [type, typedFindings] of Object.entries(findingsByType)) {
            if (typedFindings.length === 0) {continue;}
            
            report += `### ${this.formatFindingType(type)} Findings\n\n`;
            
            typedFindings.forEach((finding, index) => {
                report += `#### ${index + 1}. ${finding.summary}\n\n`;
                report += `${finding.details}\n\n`;
                
                if (finding.evidence.length > 0) {
                    report += `**Evidence:**\n`;
                    finding.evidence.forEach(ev => {
                        report += `- ${ev}\n`;
                    });
                    report += `\n`;
                }
            });
        }

        // Root cause analysis
        report += `## Root Cause Analysis\n\n`;
        report += `**Primary Cause:** ${rootCause.primaryCause}\n\n`;
        report += `**Confidence:** ${rootCause.confidence}\n\n`;
        report += `**Explanation:**\n\n`;
        report += `${rootCause.explanation}\n\n`;

        if (rootCause.correctFieldValues) {
            report += `**Correct Field Values:**\n\n`;
            for (const [field, value] of Object.entries(rootCause.correctFieldValues)) {
                report += `- \`${field}\`: ${JSON.stringify(value)}\n`;
            }
            report += `\n`;
        }

        // UI Action Plan
        if (rootCause.uiActionPlan) {
            report += `## UI Steps (Follow Exactly)\n\n`;
            report += `**Target UI:** ${rootCause.uiActionPlan.targetUi}\n\n`;
            report += `**Steps:**\n\n`;
            rootCause.uiActionPlan.steps.forEach((step, index) => {
                report += `${index + 1}. ${step}\n`;
            });
            report += `\n**Verification:**\n\n`;
            rootCause.uiActionPlan.verification.forEach((verify, index) => {
                report += `${index + 1}. ${verify}\n`;
            });
            report += `\n`;
        }

        // Affected records
        report += `**Affected Records:**\n`;
        rootCause.affectedRecords.forEach(record => {
            report += `- ${record}\n`;
        });
        report += `\n`;

        // Recommended actions
        report += `## Recommended Actions\n\n`;
        rootCause.recommendedActions.forEach((action, index) => {
            report += `${index + 1}. ${action}\n`;
        });
        report += `\n`;

        // Investigation artifacts
        report += `## Investigation Artifacts\n\n`;
        report += `All investigation artifacts are stored in:\n\n`;
        report += `- **Logs:** \`runtime/agent_workspace/logs/\`\n`;
        report += `- **Findings:** \`runtime/agent_workspace/findings/\`\n`;
        report += `- **Scripts:** \`runtime/scripts/\`\n`;
        report += `- **Retrieved Metadata:** \`runtime/agent_workspace/md/\`\n`;
        report += `\n`;

        report += `---\n\n`;
        report += `*Generated: ${date}*\n`;

        return report;
    }

    private groupFindingsByType(findings: Finding[]): Record<string, Finding[]> {
        const grouped: Record<string, Finding[]> = {
            'data': [],
            'metadata': [],
            'permission': [],
            'automation': [],
            'web-research': []
        };

        findings.forEach(finding => {
            if (grouped[finding.type]) {
                grouped[finding.type].push(finding);
            }
        });

        return grouped;
    }

    private formatFindingType(type: string): string {
        const map: Record<string, string> = {
            'data': 'Data',
            'metadata': 'Metadata',
            'permission': 'Permission',
            'automation': 'Automation',
            'web-research': 'Web Research'
        };
        return map[type] || type;
    }

    private extractRecordId(recordOrUrl: string): string | null {
        // Extract 15 or 18 character Salesforce ID from URL or string
        const match = recordOrUrl.match(/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})/);
        return match ? match[1] : null;
    }
}
