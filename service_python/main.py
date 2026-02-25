from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import logging
from nlp.normalization import normalize_text
from nlp.summarizer import summarize_items
from nlp.embeddings import search_similar
from nlp.prompt_builder import build_prompt
from nlp.token_tracker import TokenTracker
from settings import Settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Salesforce Debug Assistant Backend")
settings = Settings()
token_tracker = TokenTracker()

class NormalizeRequest(BaseModel):
    text: str

class SummarizeRequest(BaseModel):
    items: list[str]
    summary_short: bool = True

class SearchRequest(BaseModel):
    query: str
    filters: dict = {}

class BuildPromptRequest(BaseModel):
    type: str  # 'investigation', 'summary', 'resolution'
    data: dict

class LLMCallRequest(BaseModel):
    prompt: str
    session_id: str = "default"

@app.post("/normalize")
async def normalize(request: NormalizeRequest):
    try:
        normalized = normalize_text(request.text)
        return {"normalized": normalized}
    except Exception as e:
        logger.error(f"Normalization error: {e}")
        raise HTTPException(status_code=500, detail="Normalization failed")

@app.post("/summarize")
async def summarize(request: SummarizeRequest):
    try:
        summary = summarize_items(request.items, request.summary_short)
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail="Summarization failed")

@app.post("/search")
async def search(request: SearchRequest):
    try:
        results = search_similar(request.query, request.filters)
        return {"results": results}
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail="Search failed")

@app.post("/build_prompt")
async def build_prompt_endpoint(request: BuildPromptRequest):
    try:
        optimized_prompt = build_prompt(request.type, request.data)
        return {"optimized_prompt": optimized_prompt}
    except Exception as e:
        logger.error(f"Prompt building error: {e}")
        raise HTTPException(status_code=500, detail="Prompt building failed")

@app.post("/llm_call")
async def llm_call(request: LLMCallRequest):
    try:
        # Import here to avoid loading if not needed
        from nlp.llm_wrapper import call_llm
        result = call_llm(request.prompt)
        token_tracker.add_tokens(
            result['usage']['input_tokens'],
            result['usage']['output_tokens'],
            session_id=request.session_id
        )
        return result
    except Exception as e:
        logger.error(f"LLM call error: {e}")
        raise HTTPException(status_code=500, detail="LLM call failed")

@app.get("/tokens/session/{session_id}")
async def get_tokens(session_id: str):
    try:
        total = token_tracker.get_total(session_id)
        return {"total_tokens": total}
    except Exception as e:
        logger.error(f"Token retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Token retrieval failed")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)