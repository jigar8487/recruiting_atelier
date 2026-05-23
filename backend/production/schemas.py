"""All Pydantic models used at agent and HTTP boundaries (D10)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Resume / candidate models (D2, D7)
# ---------------------------------------------------------------------------


class ResumeFields(BaseModel):
    candidate_id: str
    name: str | None = None
    email: str | None = None
    years_experience: int = 0
    skills: list[str] = Field(default_factory=list)
    education: str | None = None
    raw_text: str = ""


class ScreenResult(BaseModel):
    candidate_id: str
    passed: bool
    reason: str


class ScoreBreakdown(BaseModel):
    """Per-dimension 0–100 score components.

    The agent asks the LLM for each independently; the Scorer computes the
    weighted overall in Python using the user-set ScoringConfig.
    """

    skills: int = Field(ge=0, le=100, default=0)
    experience: int = Field(ge=0, le=100, default=0)
    education: int = Field(ge=0, le=100, default=0)
    communication: int = Field(ge=0, le=100, default=0)


class ScoreResult(BaseModel):
    candidate_id: str
    score: int = Field(ge=0, le=100)
    justification: str
    # Optional: when the LLM returns the breakdown, it's preserved here so
    # the UI can render per-dimension scores. Older models / providers that
    # just return `score` still work (breakdown stays None).
    breakdown: ScoreBreakdown | None = None


class CandidateScore(BaseModel):
    candidate_id: str
    score: int = Field(ge=0, le=100)
    breakdown: ScoreBreakdown | None = None


class ScoringConfig(BaseModel):
    """User-tunable weights for the four scoring dimensions.

    Weights don't have to sum to 1.0 — the Scorer normalises by their sum
    at compute time. The UI nudges users toward 100%.
    """

    weight_skills: float = Field(ge=0, le=1, default=0.40)
    weight_experience: float = Field(ge=0, le=1, default=0.30)
    weight_education: float = Field(ge=0, le=1, default=0.15)
    weight_communication: float = Field(ge=0, le=1, default=0.15)


class DemoConfig(BaseModel):
    """Demo-mode pacing.

    The runner pauses this many seconds between agent stages (and a
    fraction of it between Kavya's per-candidate vet emits) so a live
    audience can read each Awaiting → In hand → Set transition. Set to
    0 to disable.
    """

    delay_seconds: float = Field(ge=0, le=30, default=5.0)


class Shortlist(BaseModel):
    job_id: str
    candidates: list[CandidateScore]
    created: str = Field(default_factory=_now_iso)


class NotifyResult(BaseModel):
    sent: bool
    recipient: str
    timestamp: str = Field(default_factory=_now_iso)


class EmailResult(BaseModel):
    sent: bool
    recipient: str
    subject: str
    timestamp: str = Field(default_factory=_now_iso)


class ScheduleResult(BaseModel):
    booked: bool
    candidate_id: str
    slot: str
    timestamp: str = Field(default_factory=_now_iso)


# ---------------------------------------------------------------------------
# Knowledge base & uploads (E1)
# ---------------------------------------------------------------------------


class KBDocument(BaseModel):
    id: str
    filename: str
    mime: str
    uploaded: str = Field(default_factory=_now_iso)
    chunks: int
    bytes: int


class UploadResult(BaseModel):
    doc_id: str
    filename: str
    chunks: int
    bytes: int
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Run request / event models (E1)
# ---------------------------------------------------------------------------


class ResumeInput(BaseModel):
    candidate_id: str
    text: str


class RunRequest(BaseModel):
    job_id: str
    job_description: str
    resumes: list[ResumeInput]
    top_n: int = Field(default=3, ge=1, le=10)
    max_iterations: int = Field(default=10, ge=1, le=20)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    provider: str | None = None
    chat_model: str | None = None
    recipient: str = "hiring.manager@company.com"


RunStage = Literal[
    "think", "vet", "screen", "score", "shortlist", "notify", "run", "llm"
]


class DedupResult(BaseModel):
    """Result of Kavya the Vetter checking a single resume for duplication."""

    candidate_id: str
    is_duplicate: bool
    matched_id: str | None = None  # candidate_id of the prior copy if any
    matched_when: str | None = None  # ISO timestamp of the prior scan
    reason: str = ""
RunEventType = Literal[
    "start", "chunk", "complete", "error", "warning", "retry", "token"
]


class RunEvent(BaseModel):
    run_id: str
    step: int
    stage: RunStage
    event: RunEventType
    payload: dict[str, Any] = Field(default_factory=dict)
    ts: str = Field(default_factory=_now_iso)


class RunSummary(BaseModel):
    run_id: str
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    by_stage: dict[str, dict[str, Any]] = Field(default_factory=dict)
    errors: int = 0
    latency_ms: int = 0


# ---------------------------------------------------------------------------
# LLM provider models (E2)
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    system: str
    user: str
    temperature: float = 0.7
    max_tokens: int = 1024
    response_format: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    text: str
    provider: str
    model: str
    usage: dict[str, int] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(default_factory=dict)


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    vector: list[float]
    provider: str
    model: str


class ProviderConfig(BaseModel):
    name: Literal["anthropic", "openai", "openrouter", "nvidia", "local", "fake"]
    chat_model: str | None = None
    embed_model: str | None = None
    base_url: str | None = None
    api_key_env: str | None = None
    available: bool = True


# ---------------------------------------------------------------------------
# Standard error envelope (§21.1)
# ---------------------------------------------------------------------------


class APIErrorBody(BaseModel):
    code: Literal[
        "guardrail", "auth", "rate_limit", "mcp_down",
        "validation", "not_found", "internal", "provider_unconfigured",
        "kb_too_large", "unsupported_format",
    ]
    message: str
    details: dict[str, Any] | None = None


class APIError(BaseModel):
    error: APIErrorBody
    request_id: str
