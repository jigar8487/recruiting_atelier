"""Provider settings + LLM provider listing + scoring config (E1)."""
from __future__ import annotations

from fastapi import APIRouter

from api.errors import APIException
from llm import factory
from llm.base import ProviderNotConfiguredError
from production.demo_config_store import (
    get_config as get_demo_config,
    set_config as set_demo_config,
)
from production.schemas import DemoConfig, ProviderConfig, ScoringConfig
from production.scoring_config_store import (
    get_config as get_scoring_config,
    set_config as set_scoring_config,
)

router = APIRouter()


@router.get("/providers", response_model=list[ProviderConfig])
def list_providers() -> list[ProviderConfig]:
    return factory.available()


@router.get("/provider", response_model=ProviderConfig)
def get_active_provider() -> ProviderConfig:
    return factory.active()


@router.put("/provider", response_model=ProviderConfig)
def set_active_provider(cfg: ProviderConfig) -> ProviderConfig:
    try:
        return factory.set_active(cfg)
    except ProviderNotConfiguredError as e:
        raise APIException(
            "provider_unconfigured",
            str(e),
            status_code=400,
            details={"provider": cfg.name},
        )


@router.get("/scoring", response_model=ScoringConfig)
def get_scoring() -> ScoringConfig:
    """Return the current scoring weights (skills · experience · education · communication)."""
    return get_scoring_config()


@router.put("/scoring", response_model=ScoringConfig)
def set_scoring(cfg: ScoringConfig) -> ScoringConfig:
    """Persist new scoring weights. Applies on the next /run."""
    return set_scoring_config(cfg)


@router.get("/demo", response_model=DemoConfig)
def get_demo() -> DemoConfig:
    """Return the current demo-mode pacing (delay between agent stages)."""
    return get_demo_config()


@router.put("/demo", response_model=DemoConfig)
def set_demo(cfg: DemoConfig) -> DemoConfig:
    """Persist new demo pacing. Applies on the next /run. Set delay_seconds=0 to disable."""
    return set_demo_config(cfg)
