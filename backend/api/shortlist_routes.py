"""Shortlist history (E1)."""
from __future__ import annotations

from fastapi import APIRouter

from memory.vector_store import vector_store
from production.schemas import Shortlist

router = APIRouter()


@router.get("/{job_id}", response_model=list[Shortlist])
def get_shortlists(job_id: str) -> list[Shortlist]:
    return vector_store().retrieve(job_id)
