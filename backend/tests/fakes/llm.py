"""Deterministic in-process LLM for tests and acceptance runs."""
from __future__ import annotations

import hashlib
import json
import re

from production.schemas import (
    ChatRequest,
    ChatResponse,
    EmbeddingRequest,
    EmbeddingResponse,
)


class FakeLLMProvider:
    name = "fake"
    chat_model = "fake-chat"
    embed_model = "fake-embed"
    embeddings_supported = True

    def __init__(self, responses: dict[str, str] | None = None) -> None:
        self.responses = responses or {}

    def chat(self, req: ChatRequest) -> ChatResponse:
        key = self._key(req)
        if key in self.responses:
            text = self.responses[key]
        else:
            text = self._canned(req)
        usage = {
            "input_tokens": len((req.system + req.user).split()),
            "output_tokens": len(text.split()),
        }
        return ChatResponse(
            text=text, provider=self.name, model=self.chat_model, usage=usage
        )

    def embed(self, req: EmbeddingRequest) -> EmbeddingResponse:
        # 32-dim deterministic vector based on hash. Good enough for tests.
        h = hashlib.sha256(req.text.encode()).digest()
        vec = [b / 255.0 for b in h[:32]]
        return EmbeddingResponse(
            vector=vec, provider=self.name, model=self.embed_model
        )

    @staticmethod
    def _key(req: ChatRequest) -> str:
        return hashlib.sha256(
            (req.system + "\n---\n" + req.user).encode()
        ).hexdigest()[:16]

    @staticmethod
    def _canned(req: ChatRequest) -> str:
        """Heuristic responses keyed off the agent system prompt."""
        sys = req.system.lower()

        if "parse_resume" in sys or "extract" in sys and "resume" in sys:
            yrs = _extract_years(req.user)
            email = _extract_email(req.user)
            name = _extract_name(req.user)
            return json.dumps(
                {
                    "name": name,
                    "email": email,
                    "years_experience": yrs,
                    "skills": _extract_skills(req.user),
                    "education": _extract_education(req.user),
                }
            )

        if "screen" in sys or "minimum qualification" in sys:
            cid = _extract_candidate_id(req.user) or "unknown"
            yrs = _extract_years_in_payload(req.user)
            min_yrs = 3
            if yrs >= min_yrs:
                return json.dumps(
                    {
                        "candidate_id": cid,
                        "passed": True,
                        "reason": "Meets minimum experience and skill requirements.",
                    }
                )
            return json.dumps(
                {
                    "candidate_id": cid,
                    "passed": False,
                    "reason": "insufficient years of experience",
                }
            )

        if "score" in sys or "0-100" in sys or "rubric" in sys:
            cid = _extract_candidate_id(req.user) or "unknown"
            yrs = _extract_years_in_payload(req.user)
            # Deterministic breakdown — experience dominates for the fixture
            # data, but skills/education/communication move in step with it
            # so the ordering invariant in the canonical test still holds.
            experience = min(100, 30 + yrs * 8)
            skills = min(100, 40 + yrs * 6)
            education = min(100, 50 + yrs * 3)
            communication = min(100, 55 + yrs * 2)
            overall = min(100, 50 + yrs * 5)
            return json.dumps(
                {
                    "candidate_id": cid,
                    "score": overall,
                    "breakdown": {
                        "skills": skills,
                        "experience": experience,
                        "education": education,
                        "communication": communication,
                    },
                    "justification": f"Approx {yrs}y relevant experience.",
                }
            )

        if "plan" in sys or "supervisor" in sys:
            return json.dumps(
                {
                    "plan": ["screen", "score", "shortlist", "notify"],
                    "reason": "Standard 4-stage recruitment flow.",
                }
            )

        if "email" in sys or "notify" in sys:
            return (
                "Hello team,\n\nWe have completed initial screening. "
                "Please find the shortlisted candidates attached.\n\nBest,\nThe Recruitment Agent"
            )

        return "{}"


def _extract_candidate_id(text: str) -> str | None:
    """Pull candidate_id out of a JSON payload (used by screen/score prompts)."""
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            if "candidate_id" in data:
                return str(data["candidate_id"])
            if "fields" in data and isinstance(data["fields"], dict):
                return str(data["fields"].get("candidate_id") or "") or None
    except (ValueError, TypeError):
        pass
    m = re.search(r'"candidate_id"\s*:\s*"([^"]+)"', text)
    return m.group(1) if m else None


def _extract_email(text: str) -> str | None:
    m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    return m.group(0) if m else None


def _extract_years(text: str) -> int:
    m = re.search(r"(\d+)\s*(?:\+|plus)?\s*years?", text, re.IGNORECASE)
    return int(m.group(1)) if m else 0


def _extract_years_in_payload(text: str) -> int:
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            if "years_experience" in data:
                return int(data["years_experience"] or 0)
            if "fields" in data and isinstance(data["fields"], dict):
                return int(data["fields"].get("years_experience") or 0)
            if "resume_text" in data:
                return _extract_years(str(data["resume_text"]))
    except (ValueError, TypeError):
        pass
    return _extract_years(text)


def _extract_name(text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and stripped[0].isupper() and len(stripped.split()) <= 4:
            if not _extract_email(stripped) and "@" not in stripped:
                return stripped
    return None


def _extract_skills(text: str) -> list[str]:
    pool = ["react", "python", "javascript", "typescript", "node", "django",
            "fastapi", "aws", "docker", "kubernetes", "vue", "graphql",
            "postgres", "redis", "ml", "pytorch", "tensorflow"]
    found = []
    lower = text.lower()
    for skill in pool:
        if skill in lower:
            found.append(skill)
    return found


def _extract_education(text: str) -> str | None:
    m = re.search(r"(b\.?s\.?|m\.?s\.?|ph\.?d\.?|bachelor|master|doctorate)[^.\n]*", text, re.IGNORECASE)
    return m.group(0).strip() if m else None
