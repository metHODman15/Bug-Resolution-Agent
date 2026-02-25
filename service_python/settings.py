import os
from typing import Optional

class Settings:
    def __init__(self):
        self.anthropic_api_key: Optional[str] = os.getenv('ANTHROPIC_API_KEY')
        self.model: str = os.getenv('ANTHROPIC_MODEL', 'claude-3-sonnet-20240229')
        self.max_tokens: int = int(os.getenv('MAX_TOKENS', '4096'))
        self.temperature: float = float(os.getenv('TEMPERATURE', '0.7'))

    def validate(self):
        """Validate settings."""
        if not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        if self.max_tokens <= 0:
            raise ValueError("MAX_TOKENS must be positive")
        if not (0 <= self.temperature <= 1):
            raise ValueError("TEMPERATURE must be between 0 and 1")