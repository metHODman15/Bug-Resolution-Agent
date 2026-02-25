# Token Saving Guide

This guide documents the token minimization strategies implemented in the Salesforce Debug Agent extension.

## Core Principles

- **Bounded Input**: LLM prompts are strictly limited to prevent token overflow
- **Caching**: Summaries and resolution cards reduce repeated API calls
- **Extractive Summarization**: Local processing before API calls
- **Snippet-Based**: Full documents replaced with curated snippets

## ✅ IMPLEMENTATION STATUS: FULLY INTEGRATED

The token minimization strategy is **fully implemented and integrated** throughout the extension:

- **PromptBuilder Class**: Active in `planner.ts` and `analyzer.ts`
- **Resolution Cards**: Used for issue fingerprinting and caching
- **Summary Caching**: Per-investigation session summaries
- **Snippet Extraction**: Findings converted to bounded snippets

## Input Bounds

### Session Summary
- **Short Summary**: ≤600 characters
- **Long Summary**: ≤2000 characters (cached for reuse)
- Generated locally using extractive summarization

### Snippets
- **Maximum Count**: 5 snippets per prompt
- **Per Snippet Limit**: ≤450 characters
- **Selection**: Most relevant snippets prioritized
- **Format**: `Snippet {id}: {truncated_content}`

### Prompt Structure
```
Session Summary ({char_count} chars): {summary_short}

Relevant Snippets:
Snippet 1: {content}
Snippet 2: {content}
...

Last User Message: {message}
```

## Caching Strategy

### Resolution Cards
- **Purpose**: Cache solutions for repeated bug patterns
- **Storage**: Local JSON file in extension storage
- **Fingerprinting**: Hash of symptom + object + record IDs
- **Reuse Threshold**: High confidence matches skip API calls
- **Integration**: Checked in `Planner.createPlan()` and `Analyzer.determineRootCause()`

### Summary Cache
- **Scope**: Per investigation session
- **Persistence**: Memory-only (not persisted across sessions)
- **Updates**: Incremental summarization as investigation progresses

## Output Format

All LLM responses must follow strict JSON format:

```json
{
  "plan": {...},           // Optional investigation plan
  "answer_markdown": "...", // Formatted response
  "cited_ids": ["id1", "id2"], // Referenced snippet IDs
  "ui_action_plan": {...}, // Optional UI change instructions
  "followups": ["question1", "question2"] // Suggested next steps
}
```

## Python Backend Optimization

The extension now uses a Python backend service for heavy text processing, further optimizing token usage:

### Local Processing Pipeline
1. **Terminology Normalization**: Business jargon converted to technical terms using local taxonomy
2. **Extractive Summarization**: NLTK/scikit-learn based summarization before LLM calls
3. **Prompt Optimization**: Python templates with slot filling minimize raw text in prompts
4. **Vector Search**: FAISS-based semantic search for relevant context retrieval

### Token Efficiency Improvements
- **Normalization**: Reduces prompt length by standardizing terminology
- **Local Summarization**: Processes large text locally, sends only summaries to LLM
- **Template-Based Prompts**: Uses IDs and references instead of full text
- **Semantic Deduplication**: Vector search finds and reuses similar resolved issues

### Python Service Endpoints
- `POST /normalize`: Business → technical language conversion
- `POST /summarize`: Local extractive summarization
- `POST /build_prompt`: Optimized prompt generation
- `POST /search`: Vector similarity search for context
- `POST /llm_call`: Wrapped LLM calls with usage tracking

### Token Limits
- **Hard Cap**: 4096 tokens per API call (Claude Sonnet 4)
- **Effective Limit**: ~3000 tokens after formatting overhead
- **Fallback**: Aggressive truncation if limits exceeded

### Cost Optimization
- **Resolution Cards**: Up to 90% reduction for repeated issues
- **Snippet Curation**: 80% reduction in context size
- **Summary Reuse**: 50% reduction in repeated context

## Token Counter UI

### Display Location
The token counter appears as a small badge in the **top-right corner** of chat panels:
- Investigation Plan webview
- UI Action Required webview
- Any future chat interfaces

### Appearance
- **Format**: "Tokens: ####" (numeric only)
- **Styling**: 12px font, high contrast badge background
- **Position**: Fixed top-right, non-intrusive
- **Updates**: Real-time as LLM calls complete

### How It Works
1. **Initialization**: Counter starts at 0 for each new investigation
2. **Updates**: Increments with each LLM call (input + output tokens)
3. **Persistence**: Shows running total for the entire session
4. **Reset**: Automatically resets when starting a new investigation

### Resetting Tokens
- **Automatic**: Starting a new investigation (`SF Debug: Start New Investigation`)
- **Manual**: Not currently available (session-based tracking)

### Implementation Details
- **Backend**: `TokenTracker` class accumulates totals
- **Communication**: `postMessage` events from extension to webview
- **Message Format**: `{ type: 'tokenUpdate', totalTokens: number }`
- **WebView Listener**: JavaScript updates counter display reactively