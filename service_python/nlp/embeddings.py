import os
import json
import numpy as np
from typing import List, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class VectorSearch:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        self.index_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'vector_index.json')
        self.metadata_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'metadata.json')
        self.load_or_create_index()

    def load_or_create_index(self):
        """Load existing index or create new one."""
        if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
            with open(self.index_path, 'r') as f:
                self.tfidf_matrix = np.array(json.load(f))
            with open(self.metadata_path, 'r') as f:
                self.metadata = json.load(f)
        else:
            # Create empty index
            self.tfidf_matrix = np.array([])
            self.metadata = []
            self.save_index()

    def add_documents(self, documents: List[str], metadata: List[Dict[str, Any]] = None):
        """Add documents to the vector index."""
        if not documents:
            return

        # Fit vectorizer on all documents
        all_texts = [item['text'] if isinstance(item, dict) and 'text' in item else str(item) for item in (metadata or documents)]
        if not all_texts:
            all_texts = documents

        self.tfidf_matrix = self.vectorizer.fit_transform(all_texts).toarray()

        if metadata:
            self.metadata.extend(metadata)
        else:
            self.metadata.extend([{"text": doc} for doc in documents])

        self.save_index()

    def search(self, query: str, top_k: int = 5, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Search for similar documents."""
        if self.tfidf_matrix.size == 0:
            return []

        query_vector = self.vectorizer.transform([query]).toarray()
        similarities = cosine_similarity(query_vector, self.tfidf_matrix)[0]

        # Get top results
        top_indices = np.argsort(similarities)[-top_k:][::-1]

        results = []
        for idx in top_indices:
            if idx < len(self.metadata):
                item = self.metadata[idx].copy()
                item['score'] = float(similarities[idx])
                # Apply filters if provided
                if filters:
                    if all(item.get(k) == v for k, v in filters.items()):
                        results.append(item)
                else:
                    results.append(item)

        return results

    def save_index(self):
        """Save index and metadata to disk."""
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        with open(self.index_path, 'w') as f:
            json.dump(self.tfidf_matrix.tolist(), f)
        with open(self.metadata_path, 'w') as f:
            json.dump(self.metadata, f)

def search_similar(query: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Main search function."""
    search = VectorSearch()
    return search.search(query, filters=filters)