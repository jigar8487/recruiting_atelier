"""Validation + retry around LLM calls (D10).

Every Claude/OpenAI/etc. call goes through with_retry(). On Pydantic validation
failure, retry up to MAX_RETRIES; on final failure, raise GuardrailError with
both the raw output and the validator error so callers can surface it.
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError

log = logging.getLogger(__name__)

MAX_RETRIES = 3
T = TypeVar("T", bound=BaseModel)


class GuardrailError(RuntimeError):
    def __init__(self, raw: str, validation_error: Exception) -> None:
        super().__init__(f"validation failed after {MAX_RETRIES} attempts")
        self.raw = raw
        self.validation_error = validation_error


def validate_output(raw: str, schema: type[T]) -> T:
    """Parse raw LLM output as JSON and validate against a Pydantic schema."""
    data = _extract_json(raw)
    return schema.model_validate(data)


def with_retry(
    fn: Callable[..., Any],
    schema: type[T] | None,
    *args: Any,
    **kwargs: Any,
) -> T | Any:
    """Call fn(*args, **kwargs); validate; retry on validation failure.

    When schema is None, no validation is performed and the raw return is
    passed back (useful for tool calls that already return Pydantic objects).
    """
    last_raw = ""
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        t0 = time.perf_counter()
        try:
            result = fn(*args, **kwargs)
        except Exception as e:
            last_err = e
            log.warning("retry %d: call raised %s", attempt, e)
            continue

        if schema is None:
            return result

        # fn may return a ChatResponse, a plain str, or already a BaseModel.
        if isinstance(result, schema):
            return result
        raw = getattr(result, "text", None) or (result if isinstance(result, str) else "")
        last_raw = raw or ""
        try:
            return validate_output(raw, schema)
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            last_err = e
            elapsed = int((time.perf_counter() - t0) * 1000)
            log.warning(
                "retry %d: validation failed in %dms — %s", attempt, elapsed, e
            )
    raise GuardrailError(last_raw, last_err or RuntimeError("unknown"))


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object found in model output")
    return json.loads(text[start : end + 1])
