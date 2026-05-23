"""End-to-end smoke: the canonical Senior React Developer run.

Acceptance: with the three sample resumes,
  resume_001 PASSED
  resume_002 FAILED
  resume_003 PASSED
  shortlist has resume_001 and resume_003
  notify ran and produced a NotifyResult(sent=True)
"""
from __future__ import annotations

from pathlib import Path

from production.schemas import ResumeInput, RunEvent, RunRequest
from runner import run as runner_run

DATA = Path(__file__).resolve().parents[2] / "data"


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def test_canonical_run_emits_expected_sequence():
    jd = _read(DATA / "job_descriptions" / "senior_react_developer.txt")
    resumes = [
        ResumeInput(candidate_id="resume_001",
                    text=_read(DATA / "sample_resumes" / "resume_001.txt")),
        ResumeInput(candidate_id="resume_002",
                    text=_read(DATA / "sample_resumes" / "resume_002.txt")),
        ResumeInput(candidate_id="resume_003",
                    text=_read(DATA / "sample_resumes" / "resume_003.txt")),
    ]
    req = RunRequest(
        job_id="senior-react",
        job_description=jd,
        resumes=resumes,
        top_n=3,
    )

    events: list[RunEvent] = []
    runner_run(req, emit=events.append)

    by_stage = {s: [e for e in events if e.stage == s] for s in
                ["think", "screen", "score", "shortlist", "notify", "run"]}

    # Screen: 3 chunk events, one per resume
    screen_chunks = [e for e in by_stage["screen"] if e.event == "chunk"]
    assert len(screen_chunks) == 3
    by_id = {e.payload["candidate_id"]: e.payload for e in screen_chunks}
    assert by_id["resume_001"]["passed"] is True
    assert by_id["resume_002"]["passed"] is False
    assert "year" in by_id["resume_002"]["reason"].lower()
    assert by_id["resume_003"]["passed"] is True

    # Score: 2 chunk events (only the two passers)
    score_chunks = [e for e in by_stage["score"] if e.event == "chunk"]
    assert len(score_chunks) == 2
    ids_scored = {e.payload["candidate_id"] for e in score_chunks}
    assert ids_scored == {"resume_001", "resume_003"}

    # Shortlist: one complete event with the right two ids
    shortlist = [e for e in by_stage["shortlist"] if e.event == "complete"]
    assert len(shortlist) == 1
    cands = shortlist[0].payload["candidates"]
    assert {c["candidate_id"] for c in cands} == {"resume_001", "resume_003"}
    # Highest score first
    assert cands[0]["score"] >= cands[1]["score"]

    # Notify completed
    notify = [e for e in by_stage["notify"] if e.event == "complete"]
    assert len(notify) == 1
    assert notify[0].payload["notify"]["sent"] is True

    # Final run-level completion
    runs = [e for e in by_stage["run"] if e.event == "complete"]
    assert len(runs) == 1
    assert runs[0].payload["shortlist"] is not None
