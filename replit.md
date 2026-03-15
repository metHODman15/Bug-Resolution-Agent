# Build with Agent — VS Code Extension

## Overview

A white-label agentic build assistant VS Code extension. It provides an AI-powered chat participant and sidebar webview that uses repo-driven markdown files (`.github/AGENTS.md`, `.github/copilot-instructions.md`) to configure its behavior.

The project has two components:
1. **VS Code Extension** (TypeScript/Node.js) — the main UI in `extension/src/`
2. **Python FastAPI Backend** (`service_python/`) — NLP microservice for normalization, summarization, vector search, and LLM calls

## Architecture

- `extension/src/extension.ts` — Main activation entry point
- `extension/src/chat/` — Chat participant and webview provider
- `extension/src/agent/` — Tools, config watcher, history manager
- `service_python/main.py` — FastAPI server on port 8000 (localhost)
- `service_python/nlp/` — Embeddings, normalization, prompt builder, summarizer, LLM wrapper, token tracker
- `service_python/settings.py` — Config via env vars (ANTHROPIC_API_KEY, ANTHROPIC_MODEL, etc.)

## Running on Replit

### Workflow
- **Start application**: `cd service_python && python main.py`
- Runs the FastAPI backend on `http://127.0.0.1:8000`
- Output type: console

### Environment Variables
- `ANTHROPIC_API_KEY` — Required for LLM calls via Anthropic Claude
- `ANTHROPIC_MODEL` — Default: `claude-3-sonnet-20240229`
- `MAX_TOKENS` — Default: `4096`
- `TEMPERATURE` — Default: `0.7`

## Build

```bash
npm install          # Install Node.js dev dependencies
npm run compile      # Compile TypeScript to out/
npm run lint         # Run ESLint
```

## Python Setup

```bash
cd service_python
pip install -r requirements.txt
python main.py       # Starts FastAPI on port 8000
```

## VS Code Extension Usage

This extension is designed to run inside VS Code (not as a standalone web app). Install the `.vsix` file or press F5 in VS Code to launch in debug mode.

## API Endpoints (Python Backend)

- `POST /normalize` — Text normalization
- `POST /summarize` — Item summarization
- `POST /search` — Vector similarity search
- `POST /build_prompt` — Prompt optimization
- `POST /llm_call` — LLM invocation via Anthropic
- `GET /tokens/session/{session_id}` — Token usage tracking
