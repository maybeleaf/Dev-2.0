"""Helpers for retrieving location and historical weather data."""

import os
from datetime import date
from typing import Any, Optional, Union

import requests
from dotenv import load_dotenv


load_dotenv()

GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode/search"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"



def get_coordinates(
    location: str,
) -> Optional[dict[str, Union[str, float, None]]]:
    """Look up a location with Geoapify.

    Args:
        location: Human-readable place name or address to search for.

    Returns:
        The first matching location's details, or ``None`` if there are no
        matches.

    Raises:
        ValueError: If ``location`` is empty.
        RuntimeError: If the request fails or the response is invalid.
    """
    if not location.strip():
        raise ValueError("Location cannot be empty.")

    api_key = os.getenv("GEOAPIFY_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEOAPIFY_API_KEY is missing. Add it to your .env file."
        )

    params = {
        "text": location,
        "format": "json",
        "apiKey": api_key,
    }

    try:
        response = requests.get(GEOAPIFY_URL, params=params, timeout=10)
        response.raise_for_status()
    except requests.RequestException as error:
        raise RuntimeError(f"Geoapify request failed: {error}") from error

    try:
        data = response.json()
    except ValueError as error:
        raise RuntimeError("Geoapify returned invalid JSON.") from error

    if not isinstance(data, dict):
        raise RuntimeError("Geoapify returned an unexpected response format.")

    results = data.get("results")
    if not isinstance(results, list):
        raise RuntimeError("Geoapify response is missing a valid results list.")

    if not results:
        return None

    result = results[0]
    if not isinstance(result, dict):
        raise RuntimeError("Geoapify returned an invalid result.")

    latitude = result.get("lat")
    longitude = result.get("lon")

    if not isinstance(latitude, (int, float)) or isinstance(latitude, bool):
        raise RuntimeError("Geoapify result is missing a valid latitude.")

    if not isinstance(longitude, (int, float)) or isinstance(longitude, bool):
        raise RuntimeError("Geoapify result is missing a valid longitude.")

    return {
        "name": result.get("name") or result.get("formatted") or location,
        "city": result.get("city"),
        "country": result.get("country"),
        "country_code": result.get("country_code"),
        "latitude": latitude,
        "longitude": longitude,
    }


def get_historical_weather(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
) -> dict[str, Any]:
    """Get historical daily weather data from Open-Meteo.

    Args:
        latitude: Location latitude, from -90 to 90.
        longitude: Location longitude, from -180 to 180.
        start_date: First date to retrieve, in ``YYYY-MM-DD`` format.
        end_date: Last date to retrieve, in ``YYYY-MM-DD`` format.

    Returns:
        The validated Open-Meteo response containing daily weather data.

    Raises:
        ValueError: If coordinates or dates are invalid.
        RuntimeError: If the request fails or the response is invalid.
    """
    if not -90 <= latitude <= 90:
        raise ValueError("Latitude must be between -90 and 90.")

    if not -180 <= longitude <= 180:
        raise ValueError("Longitude must be between -180 and 180.")

    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError as error:
        raise ValueError(
            "Dates must use YYYY-MM-DD format."
        ) from error

    if start > end:
        raise ValueError("start_date must be before or equal to end_date.")

    daily_fields = [
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "sunshine_duration",
    ]

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date,
        "end_date": end_date,
        "daily": ",".join(daily_fields),
        "timezone": "auto",
    }

    try:
        response = requests.get(
            OPEN_METEO_ARCHIVE_URL,
            params=params,
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        raise RuntimeError(
            f"Open-Meteo request failed: {error}"
        ) from error

    try:
        data = response.json()
    except ValueError as error:
        raise RuntimeError("Open-Meteo returned invalid JSON.") from error

    if not isinstance(data, dict):
        raise RuntimeError("Open-Meteo returned an unexpected response format.")

    daily = data.get("daily")
    if not isinstance(daily, dict):
        raise RuntimeError("Open-Meteo response is missing daily weather data.")

    for field in daily_fields:
        if not isinstance(daily.get(field), list):
            raise RuntimeError(
                f"Open-Meteo response is missing the '{field}' field."
            )

    return data


def main() -> None:
    """Prompt for a location and print its historical weather."""
    location_query = input("Location: ").strip()
    location = get_coordinates(location_query)

    if location is None:
        print(f"No location found for '{location_query}'.")
        return

    latitude = location["latitude"]
    longitude = location["longitude"]
    if not isinstance(latitude, (int, float)) or not isinstance(
        longitude, (int, float)
    ):
        raise RuntimeError("Location did not include valid coordinates.")

    print(f"Location: {location['name']}, {location['country']}")
    start_date = input("Start date (YYYY-MM-DD): ").strip()
    end_date = input("End date (YYYY-MM-DD): ").strip()

    weather = get_historical_weather(
        latitude,
        longitude,
        start_date,
        end_date,
    )
    daily = weather["daily"]

    print("\nHistorical weather:")
    for index, weather_date in enumerate(daily["time"]):
        sunshine_hours = daily["sunshine_duration"][index] / 3600
        print(
            f"{weather_date}: "
            f"{daily['temperature_2m_min'][index]:.1f} to "
            f"{daily['temperature_2m_max'][index]:.1f} C, "
            f"rain {daily['precipitation_sum'][index]:.1f} mm, "
            f"sunshine {sunshine_hours:.1f} hours"
        )


if __name__ == "__main__":
    main()