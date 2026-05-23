"""Standardized error envelope (doc §21.1)."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from production.schemas import APIError, APIErrorBody

log = logging.getLogger(__name__)


class APIException(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def _envelope(req: Request, body: APIErrorBody, status: int) -> JSONResponse:
    rid = req.headers.get("x-request-id") or uuid.uuid4().hex
    payload = APIError(error=body, request_id=rid).model_dump()
    return JSONResponse(payload, status_code=status, headers={"x-request-id": rid})


async def handle_api_exc(request: Request, exc: APIException) -> JSONResponse:
    body = APIErrorBody(code=exc.code, message=exc.message, details=exc.details)  # type: ignore[arg-type]
    return _envelope(request, body, exc.status_code)


async def handle_http_exc(request: Request, exc: HTTPException) -> JSONResponse:
    code = "not_found" if exc.status_code == 404 else "validation" if exc.status_code == 400 else "internal"
    body = APIErrorBody(code=code, message=str(exc.detail))  # type: ignore[arg-type]
    return _envelope(request, body, exc.status_code)


async def handle_validation_exc(request: Request, exc: ValidationError) -> JSONResponse:
    body = APIErrorBody(  # type: ignore[arg-type]
        code="validation",
        message="request validation failed",
        details={"errors": exc.errors()},
    )
    return _envelope(request, body, 422)


async def handle_generic(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled exception")
    body = APIErrorBody(code="internal", message=repr(exc))  # type: ignore[arg-type]
    return _envelope(request, body, 500)
