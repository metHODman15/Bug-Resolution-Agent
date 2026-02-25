import unittest
from nlp.prompt_builder import build_prompt, PromptBuilder

class TestPromptBuilder(unittest.TestCase):
    def setUp(self):
        self.builder = PromptBuilder()

    def test_build_investigation_prompt(self):
        """Test investigation prompt building."""
        data = {
            "issue": "bad UX workflow",
            "context": "Users report issues with the sales process"
        }
        prompt = build_prompt("investigation", data)
        self.assertIn("investigate", prompt.lower())
        self.assertIn("step-by-step", prompt.lower())

    def test_build_summary_prompt(self):
        """Test summary prompt building."""
        data = {
            "results": "Found validation rule issues",
            "findings": "Rule blocking lead conversion"
        }
        prompt = build_prompt("summary", data)
        self.assertIn("summarize", prompt.lower())
        self.assertIn("executive summary", prompt.lower())

    def test_build_resolution_prompt(self):
        """Test resolution prompt building."""
        data = {
            "analysis": "Validation rule is too strict",
            "issue": "Lead conversion blocked"
        }
        prompt = build_prompt("resolution", data)
        self.assertIn("resolution", prompt.lower())
        self.assertIn("prioritize", prompt.lower())

    def test_token_optimization(self):
        """Test token limit enforcement."""
        long_text = " ".join(["word"] * 2000)  # Very long text
        data = {"issue": long_text, "context": ""}
        prompt = build_prompt("investigation", data)
        # Should be truncated
        self.assertLess(len(prompt), len(long_text))

    def test_unknown_prompt_type(self):
        """Test error handling for unknown prompt types."""
        with self.assertRaises(ValueError):
            build_prompt("unknown", {})

if __name__ == '__main__':
    unittest.main()