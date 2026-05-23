"""FastAPI app factory (E1).

Run with:    uvicorn api.app:create_app --factory --reload --port 8001
"""
from __future__ import annotations

import logging
import os
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from api import errors as err
from api.errors import APIException
from api.extract_routes import router as extract_router
from api.kb_routes import router as kb_router
from api.run_routes import router as run_router
from api.settings_routes import router as settings_router
from api.shortlist_routes import router as shortlist_router
from api.tool_routes import router as tool_router

log = logging.getLogger(__name__)

API_PREFIX = "/api/v1"
STARTED_AT = time.time()


def create_app() -> FastAPI:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv()
    except ImportError:
        pass

    app = FastAPI(
        title="Recruiting Atelier API",
        version="1.0.0",
        docs_url=f"{API_PREFIX}/docs",
        openapi_url=f"{API_PREFIX}/openapi.json",
    )

    origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    # Standard error envelope (§21.1)
    app.add_exception_handler(APIException, err.handle_api_exc)  # type: ignore[arg-type]
    app.add_exception_handler(HTTPException, err.handle_http_exc)  # type: ignore[arg-type]
    app.add_exception_handler(ValidationError, err.handle_validation_exc)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, err.handle_generic)

    # Request-id middleware
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        response = await call_next(request)
        response.headers["x-request-id"] = rid
        return response

    # Healthcheck — used by frontend + docker
    @app.get("/healthz")
    def healthz() -> dict:
        from llm.factory import active
        from rag.knowledge_base import kb

        try:
            active_name = active().name
        except Exception:
            active_name = None
        return {
            "status": "ok",
            "uptime_s": int(time.time() - STARTED_AT),
            "kb_docs": kb().count(),
            "active_provider": active_name,
        }

    # Mount routers under /api/v1/*
    app.include_router(kb_router, prefix=f"{API_PREFIX}/kb", tags=["kb"])
    app.include_router(extract_router, prefix=f"{API_PREFIX}/extract", tags=["extract"])
    app.include_router(tool_router, prefix=f"{API_PREFIX}/tools", tags=["tools"])
    app.include_router(run_router, prefix=f"{API_PREFIX}/run", tags=["run"])
    app.include_router(shortlist_router, prefix=f"{API_PREFIX}/shortlists", tags=["shortlists"])
    app.include_router(settings_router, prefix=f"{API_PREFIX}/settings", tags=["settings"])
    return app
