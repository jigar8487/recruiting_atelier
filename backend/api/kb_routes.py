"""KB upload / list / delete (E1)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from api.errors import APIException
from production.schemas import KBDocument, UploadResult
from rag.knowledge_base import kb
from services.text_extract import ALLOWED, UnsupportedFormatError, extract_text

log = logging.getLogger(__name__)
router = APIRouter()

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_FILES_PER_REQUEST = 20


@router.post("/upload", response_model=list[UploadResult])
async def upload(files: list[UploadFile] = File(...)) -> list[UploadResult]:
    if len(files) > MAX_FILES_PER_REQUEST:
        raise APIException(
            "validation",
            f"too many files in one request ({len(files)} > {MAX_FILES_PER_REQUEST})",
            status_code=413,
        )
    results: list[UploadResult] = []
    for f in files:
        data = await f.read()
        if len(data) > MAX_FILE_BYTES:
            raise APIException(
                "validation",
                f"file '{f.filename}' is too large ({len(data)} bytes)",
                status_code=413,
                details={"max_bytes": MAX_FILE_BYTES},
            )
        try:
            text, warnings = extract_text(
                data, f.content_type or "", f.filename or "",
            )
        except UnsupportedFormatError as e:
            raise APIException(
                "unsupported_format",
                str(e),
                status_code=415,
                details={"allowed": sorted(ALLOWED)},
            )
        try:
            result = kb().ingest(
                text=text,
                filename=f.filename or "untitled",
                mime=f.content_type or "application/octet-stream",
                warnings=warnings,
            )
        except OverflowError as e:
            raise APIException(
                "kb_too_large",
                "in-memory KB would exceed KB_MAX_BYTES",
                status_code=413,
                details={"message": str(e)},
            )
        results.append(result)
    return results


@router.get("/list", response_model=list[KBDocument])
def list_documents() -> list[KBDocument]:
    return kb().list()


@router.delete("/{doc_id}")
def remove_document(doc_id: str) -> dict[str, bool]:
    ok = kb().remove(doc_id)
    if not ok:
        raise APIException("not_found", f"doc_id={doc_id}", status_code=404)
    return {"ok": True}


class UpdateRequest(BaseModel):
    text: str
    filename: str | None = None


@router.put("/{doc_id}", response_model=UploadResult)
def update_document(doc_id: str, body: UpdateRequest) -> UploadResult:
    try:
        result = kb().update_text(doc_id, body.text, body.filename)
    except OverflowError as e:
        raise APIException(
            "kb_too_large",
            "in-memory KB would exceed KB_MAX_BYTES",
            status_code=413,
            details={"message": str(e)},
        )
    if result is None:
        raise APIException("not_found", f"doc_id={doc_id}", status_code=404)
    return result


@router.get("/{doc_id}/text")
def get_document_text(doc_id: str) -> dict[str, str]:
    """Return the full original text of a KB document.

    Used by the run form to auto-populate the JD field from a previously
    uploaded job description.
    """
    text = kb().get_text(doc_id)
    if text is None:
        raise APIException("not_found", f"doc_id={doc_id}", status_code=404)
    return {"doc_id": doc_id, "text": text}
