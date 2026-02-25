import os
import json
from typing import Dict, Any
from nlp.normalization import normalize_text

class PromptBuilder:
    def __init__(self):
        self.templates_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'prompt_templates.json')
        self.load_templates()

    def load_templates(self):
        """Load prompt templates."""
        if os.path.exists(self.templates_path):
            with open(self.templates_path, 'r') as f:
                self.templates = json.load(f)
        else:
            # Default templates
            self.templates = {
                "investigation": {
                    "template": "Investigate the following Salesforce issue: {normalized_issue}\n\nContext: {context}\n\nProvide a step-by-step analysis.",
                    "max_tokens": 1000
                },
                "summary": {
                    "template": "Summarize the following investigation results: {results}\n\nKey findings: {findings}",
                    "max_tokens": 500
                },
                "resolution": {
                    "template": "Based on the analysis: {analysis}\n\nSuggest resolutions for: {issue}\n\nPrioritize by impact.",
                    "max_tokens": 800
                }
            }

    def build_investigation_prompt(self, data: Dict[str, Any]) -> str:
        """Build investigation prompt."""
        normalized_issue = normalize_text(data.get('issue', ''))
        context = data.get('context', '')

        template = self.templates['investigation']['template']
        prompt = template.format(
            normalized_issue=normalized_issue,
            context=context
        )

        return self.optimize_for_tokens(prompt, self.templates['investigation']['max_tokens'])

    def build_summary_prompt(self, data: Dict[str, Any]) -> str:
        """Build summary prompt."""
        results = data.get('results', '')
        findings = data.get('findings', '')

        template = self.templates['summary']['template']
        prompt = template.format(
            results=results,
            findings=findings
        )

        return self.optimize_for_tokens(prompt, self.templates['summary']['max_tokens'])

    def build_resolution_prompt(self, data: Dict[str, Any]) -> str:
        """Build resolution prompt."""
        analysis = data.get('analysis', '')
        issue = data.get('issue', '')

        template = self.templates['resolution']['template']
        prompt = template.format(
            analysis=analysis,
            issue=issue
        )

        return self.optimize_for_tokens(prompt, self.templates['resolution']['max_tokens'])

    def optimize_for_tokens(self, prompt: str, max_tokens: int) -> str:
        """Optimize prompt to fit within token limit."""
        # Simple word-based approximation (1 token ≈ 0.75 words)
        estimated_tokens = len(prompt.split()) * 1.33

        if estimated_tokens <= max_tokens:
            return prompt

        # Truncate if too long
        words = prompt.split()
        max_words = int(max_tokens / 1.33)
        truncated = " ".join(words[:max_words])

        return truncated + "..."

def build_prompt(prompt_type: str, data: Dict[str, Any]) -> str:
    """Main prompt building function."""
    builder = PromptBuilder()

    if prompt_type == 'investigation':
        return builder.build_investigation_prompt(data)
    elif prompt_type == 'summary':
        return builder.build_summary_prompt(data)
    elif prompt_type == 'resolution':
        return builder.build_resolution_prompt(data)
    else:
        raise ValueError(f"Unknown prompt type: {prompt_type}")