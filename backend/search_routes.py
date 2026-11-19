from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.algorith import (
    DEFAULT_TOP_N,
    clean_category,
    get_weights,
    rank_stays,
)

router = APIRouter()


@router.get("/flights")
def search_flights(
    origin: str,
    destination: str,
    date: str,
    direction: str = "outbound",
) -> list[dict[str, Any]]:
    """Return flight options. Empty until real data is connected."""
    return []


@router.get("/stays")
def search_stays(
    destination: str,
    check_in: str,
    check_out: str,
    travelers: int = 1,
) -> list[dict[str, Any]]:
    """Return stay options. Empty until real data is connected."""
    return []


class RankStaysRequest(BaseModel):
    """What the frontend sends to have its stays ranked."""

    stays: list[dict[str, Any]] = Field(
        description="Stay listings. Each needs pricePerNight; rating is optional."
    )
    budget: float = Field(description="The STAYS budget for the whole trip, not the trip total.")
    nights: int = Field(description="Number of nights.")
    mode: str = Field("balanced", description='Preset: "cheapest", "balanced" or "nicest".')
    weights: Optional[dict[str, Any]] = Field(
        None,
        description='Optional custom stays weights, e.g. from the AI: {"price": 0.3, "rating": 0.7}. '
        "Overrides mode. Cleaned before use.",
    )
    sort_by: str = Field("score", description='"score", "price" or "rating".')
    top_n: int = Field(DEFAULT_TOP_N, ge=1, le=100)


@router.post("/stays/rank")
def rank_stays_route(req: RankStaysRequest) -> dict[str, Any]:
    """
    Rank stays the frontend already has (split by job: the backend ranks,
    the frontend planner picks one and builds the days).

    Returns:
        results: the top stays, best first, each with a "score" (0..1) added
        warning: None, or a short message the UI can show
                 (e.g. nothing fit the budget, so the closest options are shown)
        weights: the stays weights actually used, after cleaning
    """
    if req.weights is None:
        used = get_weights(req.mode, "stays")
    else:
        used = clean_category(req.weights, "stays")

    results, warning = rank_stays(
        req.stays,
        budget=req.budget,
        nights=req.nights,
        mode=req.mode,
        sort_by=req.sort_by,
        top_n=req.top_n,
        weights=req.weights,
    )
    return {"results": results, "warning": warning, "weights": used}
