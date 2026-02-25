import json
import os
from fuzzywuzzy import fuzz
from typing import Dict, List

class TerminologyNormalizer:
    def __init__(self):
        self.taxonomy_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'taxonomy.json')
        self.load_taxonomy()

    def load_taxonomy(self):
        """Load business to technical terminology mappings."""
        if os.path.exists(self.taxonomy_path):
            with open(self.taxonomy_path, 'r') as f:
                self.taxonomy = json.load(f)
        else:
            # Default mappings
            self.taxonomy = {
                "business_jargon": {
                    "bad UX workflow": "Flow fails because criteria logic mismatched",
                    "sales process stuck": "Lead conversion blocked by validation rules",
                    "customer data not syncing": "Data integration failure between Salesforce and external system",
                    "report not loading": "SOQL query timeout or governor limits exceeded",
                    "user can't login": "Authentication failure due to permission sets or profiles",
                    "deal not closing": "Opportunity stage progression blocked by approval processes"
                },
                "synonyms": {
                    "bug": ["issue", "problem", "error", "defect"],
                    "workflow": ["process", "flow", "automation"],
                    "data": ["information", "records", "fields"],
                    "user": ["person", "employee", "customer"]
                }
            }

    def normalize_business_to_technical(self, text: str) -> str:
        """Convert business jargon to technical terms using exact and fuzzy matching."""
        normalized = text.lower()

        # Exact matches first
        for business, technical in self.taxonomy["business_jargon"].items():
            if business.lower() in normalized:
                normalized = normalized.replace(business.lower(), technical.lower())

        # Fuzzy matching for business jargon phrases (if no exact match found)
        if normalized == text.lower():  # No exact matches were made
            for business, technical in self.taxonomy["business_jargon"].items():
                if fuzz.ratio(normalized, business.lower()) > 70:  # Lower threshold for phrases
                    normalized = technical.lower()
                    break

        # Fuzzy matching for synonyms
        words = normalized.split()
        for i, word in enumerate(words):
            for category, synonyms in self.taxonomy["synonyms"].items():
                if word in synonyms:
                    words[i] = category
                    break
                # Fuzzy match with threshold
                for synonym in synonyms:
                    if fuzz.ratio(word, synonym) > 80:
                        words[i] = category
                        break

        return " ".join(words)

    def expand_synonyms(self, text: str) -> List[str]:
        """Generate variations of text using synonyms for better search."""
        variations = [text]
        words = text.split()

        for i, word in enumerate(words):
            for category, synonyms in self.taxonomy["synonyms"].items():
                if word == category:
                    for synonym in synonyms:
                        variation = words.copy()
                        variation[i] = synonym
                        variations.append(" ".join(variation))

        return list(set(variations))  # Remove duplicates

def normalize_text(text: str) -> str:
    """Main normalization function."""
    normalizer = TerminologyNormalizer()
    return normalizer.normalize_business_to_technical(text)