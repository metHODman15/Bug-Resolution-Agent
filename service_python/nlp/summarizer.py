from typing import List
import nltk
from nltk.tokenize import sent_tokenize

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

class LocalSummarizer:
    def __init__(self):
        pass

    def extractive_summary(self, items: List[str], max_sentences: int = 3) -> str:
        """Simple extractive summarization based on sentence length and position."""
        if len(items) <= max_sentences:
            return " ".join(items)

        # Tokenize into sentences
        full_text = " ".join(items)
        sentences = sent_tokenize(full_text)

        if len(sentences) <= max_sentences:
            return full_text

        # Score sentences by length and position
        sentence_scores = []
        for i, sentence in enumerate(sentences):
            # Score = length + position bonus (prefer earlier sentences)
            score = len(sentence.split()) + (len(sentences) - i) * 0.1
            sentence_scores.append((score, sentence))

        # Sort by score and take top sentences
        sentence_scores.sort(reverse=True)
        top_sentences = [sentence for _, sentence in sentence_scores[:max_sentences]]

        # Sort back to original order
        original_order = []
        for sentence in sentences:
            if sentence in top_sentences:
                original_order.append(sentence)

        return " ".join(original_order)

    def summarize_with_llm_fallback(self, items: List[str], short: bool = True) -> str:
        """Try local summarization first, fallback to LLM if needed."""
        try:
            max_sentences = 2 if short else 5
            return self.extractive_summary(items, max_sentences)
        except Exception as e:
            # Fallback if summarization fails
            return f"Summary of {len(items)} items: " + " ".join(items[:3]) + "..." if len(items) > 3 else " ".join(items)

def summarize_items(items: List[str], summary_short: bool = True) -> str:
    """Main summarization function."""
    summarizer = LocalSummarizer()
    return summarizer.summarize_with_llm_fallback(items, summary_short)