from typing import Dict
import threading

class TokenTracker:
    def __init__(self):
        self.sessions: Dict[str, Dict[str, int]] = {}
        self.lock = threading.Lock()

    def add_tokens(self, input_tokens: int, output_tokens: int, session_id: str = "default"):
        """Add tokens to a session."""
        with self.lock:
            if session_id not in self.sessions:
                self.sessions[session_id] = {"input": 0, "output": 0, "total": 0}

            self.sessions[session_id]["input"] += input_tokens
            self.sessions[session_id]["output"] += output_tokens
            self.sessions[session_id]["total"] += input_tokens + output_tokens

    def get_total(self, session_id: str = "default") -> int:
        """Get total tokens for a session."""
        with self.lock:
            return self.sessions.get(session_id, {"total": 0})["total"]

    def get_breakdown(self, session_id: str = "default") -> Dict[str, int]:
        """Get token breakdown for a session."""
        with self.lock:
            return self.sessions.get(session_id, {"input": 0, "output": 0, "total": 0}).copy()

    def reset_session(self, session_id: str = "default"):
        """Reset token count for a session."""
        with self.lock:
            self.sessions[session_id] = {"input": 0, "output": 0, "total": 0}

    def list_sessions(self) -> Dict[str, Dict[str, int]]:
        """List all sessions and their token usage."""
        with self.lock:
            return self.sessions.copy()