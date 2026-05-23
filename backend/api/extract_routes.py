"""One-off file → text extraction (used by the run form for PDF/DOCX resumes)."""
from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from api.errors import APIException
from services.text_extract import ALLOWED, UnsupportedFormatError, extract_text

router = APIRouter()

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("")
async def extract(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise APIException(
            "validation",
            f"file '{file.filename}' is too large ({len(data)} bytes)",
            status_code=413,
            details={"max_bytes": MAX_FILE_BYTES},
        )
    try:
        text, warnings = extract_text(
            data, file.content_type or "", file.filename or "",
        )
    except UnsupportedFormatError as e:
        raise APIException(
            "unsupported_format",
            str(e),
            status_code=415,
            details={"allowed": sorted(ALLOWED)},
        )
    return {"text": text, "warnings": warnings, "filename": file.filename or ""}
