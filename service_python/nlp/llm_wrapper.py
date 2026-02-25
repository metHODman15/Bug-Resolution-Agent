import anthropic
from settings import Settings
from typing import Dict, Any

class LLMWrapper:
    def __init__(self):
        self.settings = Settings()
        self.settings.validate()
        self.client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)

    def call(self, prompt: str) -> Dict[str, Any]:
        """Make a call to the LLM."""
        try:
            message = self.client.messages.create(
                model=self.settings.model,
                max_tokens=self.settings.max_tokens,
                temperature=self.settings.temperature,
                system="You are a Salesforce debugging assistant. Provide structured, actionable solutions.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Extract response
            response_text = message.content[0].text if message.content else ""

            # Extract usage
            usage = {
                "input_tokens": message.usage.input_tokens,
                "output_tokens": message.usage.output_tokens
            }

            return {
                "answer": response_text,
                "cited_ids": [],  # Could be populated based on context
                "reasoning": "Analysis completed using optimized prompt",
                "usage": usage
            }

        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")

def call_llm(prompt: str) -> Dict[str, Any]:
    """Main LLM call function."""
    wrapper = LLMWrapper()
    return wrapper.call(prompt)