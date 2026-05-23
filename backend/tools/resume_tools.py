"""Resume-domain tools (D2).

The Tool Registry Pattern in practice. Three moving parts:

  TOOLS list      — JSON schemas the LLM sees (below, at the top of the file).
  TOOL_MAP dict   — name → function (further below, after the implementations).
  Tool functions  — single-purpose, deterministic, typed Python.

Agents never import these functions directly. They call them through the
registry: `registry.call("parse_resume", resume_text=..., candidate_id=...)`.

Each tool calls the active LLM provider via the factory; falls back to regex
extraction on malformed model output so the pipeline keeps moving.
"""
from __future__ import annotations

import json
import re
import uuid

from llm import factory
from production.schemas import ChatRequest, ResumeFields


# =====================================================================
# TOOLS — Tool Definitions (what the LLM sees)
# =====================================================================
#
# Hand-written JSON Schema. Order matters here: `description` is the most
# important field — the LLM uses it to decide WHEN to call. Be specific.
# Every property carries its own `description` so the model knows what
# to put there. `required` lists the parameters the LLM must always
# supply (anything optional is omitted).

TOOLS: list[dict] = [
    {
        "name": "parse_resume",
        "description": (
            "Extract structured fields (name, email, years of experience, "
            "skills, education) from raw resume text. Use this BEFORE "
            "scoring or shortlisting — it produces typed candidate data "
            "the rest of the pipeline relies on."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "resume_text": {
                    "type": "string",
                    "description": (
                        "Full plain-text resume content. May include section "
                        "headers, line breaks, and bullet points."
                    ),
                },
                "candidate_id": {
                    "type": "string",
                    "description": (
                        "Stable identifier for the candidate (e.g. the file "
                        "stem). If omitted, a new id is generated."
                    ),
                },
            },
            "required": ["resume_text"],
        },
    },
    {
        "name": "score_candidate",
        "description": (
            "Score a candidate 0–100 against a job description using the "
            "rubric: 80–100 strong match, 60–79 good, 40–59 partial, 0–39 "
            "weak. Deterministic (temperature=0) — same inputs give the "
            "same score."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "resume_text": {
                    "type": "string",
                    "description": "Full plain-text resume content.",
                },
                "jd_text": {
                    "type": "string",
                    "description": (
                        "Full plain-text job description. Should list "
                        "must-haves and nice-to-haves explicitly."
                    ),
                },
                "candidate_id": {
                    "type": "string",
                    "description": (
                        "Optional candidate id for tracing/logging. Not "
                        "used in the scoring math itself."
                    ),
                },
            },
            "required": ["resume_text", "jd_text"],
        },
    },
]


# =====================================================================
# Prompts (rubrics passed as system messages to the LLM)
# =====================================================================

PARSE_RESUME_RUBRIC = """You are a precise resume parser. Given resume text, return a single JSON object with these keys:
  name (string|null)
  email (string|null)
  years_experience (integer)
  skills (list of lowercase strings)
  education (string|null)

Rules:
- Do not invent fields. If a field cannot be extracted, use null (or 0 for years).
- Output ONLY the JSON object. No prose, no markdown fences.
"""


SCORE_RUBRIC = """You are an HR scorer. Given a job description and a resume, return a single JSON object:
  score (integer 0-100)
  justification (string, max 200 chars)

Rubric:
- 80-100: strong match (all must-haves + most nice-to-haves)
- 60-79:  good match (all must-haves)
- 40-59:  partial match (some must-haves missing)
- 0-39:   weak match

Rules:
- Output ONLY the JSON object. No prose, no markdown fences.
- Be consistent: same inputs should produce the same score.
"""


# =====================================================================
# Tool functions (what your code actually runs)
# =====================================================================

def parse_resume(resume_text: str, candidate_id: str | None = None) -> ResumeFields:
    """Extract typed fields from resume text. Robust against malformed LLM output."""
    cid = candidate_id or f"cand_{uuid.uuid4().hex[:8]}"
    req = ChatRequest(
        system=PARSE_RESUME_RUBRIC,
        user=resume_text,
        temperature=0.0,
        max_tokens=512,
    )
    try:
        resp = factory.traced_chat(None, req)  # picks run_id from contextvar
        data = _extract_json(resp.text)
        return ResumeFields(
            candidate_id=cid,
            name=data.get("name"),
            email=data.get("email"),
            years_experience=int(data.get("years_experience") or 0),
            skills=list(data.get("skills") or []),
            education=data.get("education"),
            raw_text=resume_text,
        )
    except (ValueError, TypeError, KeyError):
        return _regex_fallback(cid, resume_text)


def score_candidate(
    resume_text: str,
    jd_text: str,
    candidate_id: str | None = None,
) -> int:
    """Score 0-100. temperature=0 for determinism."""
    req = ChatRequest(
        system=SCORE_RUBRIC,
        user=f"JOB DESCRIPTION:\n{jd_text}\n\nRESUME:\n{resume_text}",
        temperature=0.0,
        max_tokens=256,
    )
    try:
        resp = factory.traced_chat(None, req)
        data = _extract_json(resp.text)
        score = int(data.get("score", 0))
        return max(0, min(100, score))
    except (ValueError, TypeError, KeyError):
        return 0


# =====================================================================
# TOOL_MAP — name → function (what your code runs)
# =====================================================================
#
# Sits AFTER the function definitions so it can reference them directly.
# Keys must match the `name` field on the corresponding TOOLS entry.

TOOL_MAP = {
    "parse_resume": parse_resume,
    "score_candidate": score_candidate,
}


# =====================================================================
# Helpers
# =====================================================================

def _extract_json(text: str) -> dict:
    """Find the first {...} block in `text` and parse it."""
    text = text.strip()
    if text.startswith("```"):
        # strip markdown fences if a model added them
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object found in model output")
    return json.loads(text[start : end + 1])


def _regex_fallback(candidate_id: str, text: str) -> ResumeFields:
    email_m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    years_m = re.search(r"(\d+)\s*\+?\s*years?", text, re.IGNORECASE)
    edu_m = re.search(
        r"(b\.?s\.?|m\.?s\.?|ph\.?d\.?|bachelor|master|doctorate)[^.\n]*",
        text,
        re.IGNORECASE,
    )
    skill_pool = [
        "react", "python", "typescript", "javascript", "node", "django",
        "fastapi", "aws", "docker", "kubernetes", "vue", "graphql",
        "postgres", "redis", "pytorch", "tensorflow",
    ]
    lower = text.lower()
    skills = [s for s in skill_pool if s in lower]

    name = None
    for line in text.splitlines():
        s = line.strip()
        if s and s[0].isupper() and "@" not in s and len(s.split()) <= 4:
            name = s
            break

    return ResumeFields(
        candidate_id=candidate_id,
        name=name,
        email=email_m.group(0) if email_m else None,
        years_experience=int(years_m.group(1)) if years_m else 0,
        skills=skills,
        education=edu_m.group(0).strip() if edu_m else None,
        raw_text=text,
    )


# =====================================================================
# Wiring into the shared registry
# =====================================================================

def register_into(registry) -> None:
    """Convenience: register every (TOOLS, TOOL_MAP) pair into the registry."""
    import sys
    registry.register_module(sys.modules[__name__])
