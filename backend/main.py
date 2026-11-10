"""FastAPI application for the Lift Off backend."""

import json
from typing import Any

from fastapi import Body, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.auth import current_user
from backend.auth import router as auth_router
from backend.db import get_connection, init_db
from backend.search_routes import router as search_router
from backend.services.API_calling import (
    get_coordinates,
    get_historical_weather,
)


app = FastAPI(title="Lift Off API")

init_db()
app.include_router(search_router)
app.include_router(auth_router)

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

@app.get("/trips")
def list_trips(user: dict = Depends(current_user)) -> list[dict[str, Any]]:
    """Return the logged-in user's trips, newest first."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT data FROM trips WHERE user_id = ? ORDER BY updated_at DESC",
            (user["id"],),
        ).fetchall()
    return [json.loads(row["data"]) for row in rows]


@app.put("/trips/{trip_id}")
def save_trip(
    trip_id: str,
    trip: dict[str, Any] = Body(...),
    user: dict = Depends(current_user),
) -> dict[str, str]:
    """Create or update one of the logged-in user's trips."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO trips (id, data, user_id) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                updated_at = CURRENT_TIMESTAMP
            WHERE trips.user_id = excluded.user_id
            """,
            (trip_id, json.dumps(trip), user["id"]),
        )
    return {"id": trip_id}


@app.delete("/trips/{trip_id}")
def delete_trip(trip_id: str, user: dict = Depends(current_user)) -> dict[str, str]:
    """Delete one of the logged-in user's trips."""
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM trips WHERE id = ? AND user_id = ?", (trip_id, user["id"])
        )
    return {"id": trip_id}