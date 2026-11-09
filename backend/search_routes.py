from typing import Any

from fastapi import APIRouter

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