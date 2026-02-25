import unittest
from nlp.normalization import normalize_text, TerminologyNormalizer

class TestNormalization(unittest.TestCase):
    def setUp(self):
        self.normalizer = TerminologyNormalizer()

    def test_business_to_technical_mapping(self):
        """Test exact business jargon to technical mapping."""
        input_text = "bad UX workflow"
        expected = "flow fails because criteria logic mismatched"
        result = normalize_text(input_text)
        self.assertIn(expected, result.lower())

    def test_synonym_expansion(self):
        """Test synonym expansion."""
        variations = self.normalizer.expand_synonyms("bug in workflow")
        self.assertGreater(len(variations), 1)
        self.assertIn("bug in workflow", variations)

    def test_fuzzy_matching(self):
        """Test fuzzy matching for synonyms."""
        # This would require more complex setup, but basic test
        result = normalize_text("users can't login")
        self.assertIn("authentication failure", result.lower())

    def test_case_insensitivity(self):
        """Test case insensitive normalization."""
        result1 = normalize_text("Bad UX Workflow")
        result2 = normalize_text("bad ux workflow")
        self.assertEqual(result1.lower(), result2.lower())

if __name__ == '__main__':
    unittest.main()