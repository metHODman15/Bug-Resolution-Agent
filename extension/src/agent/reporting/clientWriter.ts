import * as fs from 'fs';
import * as path from 'path';
import { InvestigationPlan, Finding, RootCauseAnalysis } from '../state';

/**
 * Client Writer - Generates client-facing action reports
 * Focus on what to do, step-by-step instructions, no internal paths
 */

export class ClientWriter {
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

        const content = this.generateClientReport(plan, findings, rootCause);
        const filePath = path.join(reportDir, 'Client.md');
        
        fs.writeFileSync(filePath, content, 'utf8');
    }

    private generateClientReport(
        plan: InvestigationPlan,
        findings: Finding[],
        rootCause: RootCauseAnalysis
    ): string {
        const date = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        let report = `# Resolution Guide\n\n`;
        report += `**Date:** ${date}\n\n`;
        report += `**Issue:** ${plan.context.symptom}\n\n`;
        report += `---\n\n`;

        // Summary section
        report += `## Summary\n\n`;
        report += this.generateExecutiveSummary(rootCause);
        report += `\n\n`;

        // Step-by-step resolution
        report += `## How to Resolve\n\n`;
        report += this.generateStepByStepInstructions(rootCause, plan);
        report += `\n`;

        // Example records with recommended changes
        if (rootCause.correctFieldValues && Object.keys(rootCause.correctFieldValues).length > 0) {
            report += `## Recommended Changes for Example Records\n\n`;
            report += this.generateRecordChangeInstructions(rootCause, plan);
            report += `\n`;
        }

        // Verification steps
        report += `## How to Verify the Fix\n\n`;
        report += this.generateVerificationSteps(rootCause, plan);
        report += `\n`;

        // When to escalate
        if (rootCause.confidence !== 'high') {
            report += `## When to Escalate\n\n`;
            report += this.generateEscalationGuidance(rootCause);
            report += `\n`;
        }

        // Prevention
        report += `## How to Prevent This in the Future\n\n`;
        report += this.generatePreventionGuidance(rootCause);
        report += `\n`;

        report += `---\n\n`;
        report += `*If you have questions about this resolution, please contact your Salesforce administrator.*\n`;

        return report;
    }

    private generateExecutiveSummary(rootCause: RootCauseAnalysis): string {
        let summary = '';
        
        if (rootCause.primaryCause === 'data') {
            summary = 'The issue is caused by incorrect or incomplete data. The records need to be updated with the correct field values.';
        } else if (rootCause.primaryCause === 'system') {
            summary = 'The issue is caused by system automation or configuration. An administrator needs to review and adjust the settings.';
        } else if (rootCause.primaryCause === 'permission') {
            summary = 'The issue is caused by permission or access restrictions. User permissions need to be reviewed and updated.';
        } else if (rootCause.primaryCause === 'configuration') {
            summary = 'The issue is caused by system configuration. Settings need to be reviewed and adjusted by an administrator.';
        } else {
            summary = 'Additional investigation is needed to determine the exact cause. Please review the findings and consult with your administrator.';
        }

        return summary;
    }

    private generateStepByStepInstructions(
        rootCause: RootCauseAnalysis,
        _plan: InvestigationPlan
    ): string {
        let instructions = '';

        rootCause.recommendedActions.forEach((action, index) => {
            instructions += `### Step ${index + 1}\n\n`;
            instructions += `${action}\n\n`;
            
            // Add helpful context based on action type
            if (action.toLowerCase().includes('field')) {
                instructions += `**How to update a field:**\n`;
                instructions += `1. Open the record in Salesforce\n`;
                instructions += `2. Click "Edit"\n`;
                instructions += `3. Update the field value\n`;
                instructions += `4. Click "Save"\n\n`;
            } else if (action.toLowerCase().includes('permission') || action.toLowerCase().includes('access')) {
                instructions += `**Note:** Permission changes must be made by a Salesforce Administrator.\n\n`;
            } else if (action.toLowerCase().includes('workflow') || action.toLowerCase().includes('automation')) {
                instructions += `**Note:** Automation changes must be made by a Salesforce Administrator.\n\n`;
            }
        });

        return instructions;
    }

    private generateRecordChangeInstructions(
        rootCause: RootCauseAnalysis,
        _plan: InvestigationPlan
    ): string {
        let instructions = 'For each of the following records, update the fields as shown:\n\n';

        rootCause.affectedRecords.forEach((recordId, index) => {
            const cleanRecordId = this.extractRecordId(recordId);
            instructions += `### Record ${index + 1}\n\n`;
            instructions += `**Record ID:** ${cleanRecordId}\n\n`;
            instructions += `**Record URL:** ${this.formatRecordUrl(cleanRecordId, _plan.context.orgAlias)}\n\n`;
            instructions += `**Fields to Update:**\n\n`;
            
            if (rootCause.correctFieldValues) {
                for (const [field, value] of Object.entries(rootCause.correctFieldValues)) {
                    const displayField = this.formatFieldName(field);
                    const displayValue = this.formatFieldValue(value);
                    instructions += `- **${displayField}:** ${displayValue}\n`;
                }
            }
            
            instructions += `\n`;
        });

        return instructions;
    }

    private generateVerificationSteps(
        rootCause: RootCauseAnalysis,
        _plan: InvestigationPlan
    ): string {
        let steps = '';

        steps += `After making the recommended changes:\n\n`;
        steps += `1. Open one of the affected records\n`;
        steps += `2. Verify that the fields show the correct values\n`;
        steps += `3. Test the functionality that was previously failing\n`;
        steps += `4. Confirm that the issue is resolved\n`;
        
        if (rootCause.primaryCause === 'system' || rootCause.primaryCause === 'configuration') {
            steps += `5. Test with a new record to ensure automation works correctly\n`;
        }
        
        steps += `\n`;
        steps += `If the issue persists after following these steps, please escalate to your Salesforce administrator.\n`;

        return steps;
    }

    private generateEscalationGuidance(rootCause: RootCauseAnalysis): string {
        let guidance = 'Escalate to your Salesforce administrator if:\n\n';
        guidance += `- The recommended changes do not resolve the issue\n`;
        guidance += `- You do not have permission to make the necessary changes\n`;
        guidance += `- The issue affects more records than originally identified\n`;
        
        if (rootCause.confidence === 'low') {
            guidance += `- Additional investigation is needed (confidence level is low)\n`;
        }
        
        guidance += `\n`;
        guidance += `When escalating, provide this report and the example record URLs.\n`;

        return guidance;
    }

    private generatePreventionGuidance(rootCause: RootCauseAnalysis): string {
        let guidance = '';

        if (rootCause.primaryCause === 'data') {
            guidance = 'To prevent similar issues:\n\n';
            guidance += `- Review data entry procedures and validation\n`;
            guidance += `- Provide training on required field values\n`;
            guidance += `- Consider adding validation rules to enforce correct data entry\n`;
        } else if (rootCause.primaryCause === 'system') {
            guidance = 'To prevent similar issues:\n\n';
            guidance += `- Review automation rules with your administrator\n`;
            guidance += `- Document expected system behavior\n`;
            guidance += `- Test automation changes in a sandbox first\n`;
        } else if (rootCause.primaryCause === 'permission') {
            guidance = 'To prevent similar issues:\n\n';
            guidance += `- Review user permissions regularly\n`;
            guidance += `- Document required permissions for each role\n`;
            guidance += `- Request permission changes proactively\n`;
        } else {
            guidance = 'To prevent similar issues:\n\n';
            guidance += `- Document the resolution for future reference\n`;
            guidance += `- Share learnings with your team\n`;
            guidance += `- Monitor for similar patterns\n`;
        }

        return guidance;
    }

    private extractRecordId(recordOrUrl: string): string {
        // Extract 15 or 18 character Salesforce ID from URL or string
        const match = recordOrUrl.match(/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})/);
        return match ? match[1] : recordOrUrl;
    }

    private formatRecordUrl(recordId: string, _orgAlias: string): string {
        // Return a generic Salesforce record URL format
        return `[Open Record](https://[your-instance].lightning.force.com/lightning/r/[object]/${recordId}/view)`;
    }

    private formatFieldName(fieldApiName: string): string {
        // Convert API name to readable format
        let readable = fieldApiName.replace(/__c$/, '').replace(/_/g, ' ');
        readable = readable.replace(/\b\w/g, l => l.toUpperCase());
        return readable;
    }

    private formatFieldValue(value: unknown): string {
        if (value === null || value === undefined) {
            return '(empty)';
        }
        if (typeof value === 'boolean') {
            return value ? 'Checked' : 'Unchecked';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }
}
