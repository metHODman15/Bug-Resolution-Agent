import unittest
import os
from nlp.embeddings import VectorSearch

class TestVectorSearch(unittest.TestCase):
    def setUp(self):
        self.search = VectorSearch()
        # Add some test documents
        self.test_docs = [
            "Salesforce validation rule blocking lead conversion",
            "User authentication failure due to permission sets",
            "SOQL query timeout causing report loading issues",
            "Data integration failure between Salesforce and external system"
        ]
        self.test_metadata = [{"id": i, "text": doc} for i, doc in enumerate(self.test_docs)]
        self.search.add_documents(self.test_docs, self.test_metadata)

    def test_search_similar(self):
        """Test basic similarity search."""
        results = self.search.search("login problem", top_k=2)
        self.assertGreater(len(results), 0)
        self.assertIn("score", results[0])

    def test_search_with_filters(self):
        """Test search with metadata filters."""
        results = self.search.search("validation", filters={"id": 0})
        # Should return only the first document if filter matches
        if results:
            self.assertEqual(results[0]["id"], 0)

    def test_empty_query(self):
        """Test handling of empty query."""
        results = self.search.search("", top_k=1)
        # Should handle gracefully
        self.assertIsInstance(results, list)

    def test_top_k_limit(self):
        """Test that top_k limits results."""
        results = self.search.search("salesforce", top_k=1)
        self.assertLessEqual(len(results), 1)

if __name__ == '__main__':
    unittest.main()