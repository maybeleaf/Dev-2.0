"""FastAPI application for the Lift Off backend."""

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.services.API_calling import (
    get_coordinates,
    get_historical_weather,
)


app = FastAPI(title="Lift Off API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Return a simple status response for server checks."""
    return {"status": "ok"}


@app.get("/weather")
def weather(
    location: str,
    start_date: str,
    end_date: str,
) -> dict[str, Any]:
    """Find a location and return its historical daily weather."""
    try:
        coordinates = get_coordinates(location)

        if coordinates is None:
            raise HTTPException(
                status_code=404,
                detail=f"Location not found: {location}",
            )

        latitude = coordinates["latitude"]
        longitude = coordinates["longitude"]
        if not isinstance(latitude, (int, float)) or not isinstance(
            longitude, (int, float)
        ):
            raise RuntimeError("Location did not include valid coordinates.")

        weather_data = get_historical_weather(
            latitude,
            longitude,
            start_date,
            end_date,
        )
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    return {
        "location": coordinates,
        "weather": weather_data,
    }
