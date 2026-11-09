# Lift Off ✈️

**Vacation is supposed to be a break. Don't make planning it a hassle.**

Lift Off is a trip planner. Type something like *"a relaxed week in Tokyo for two in April, under $6k"* and it plans the whole trip: flights, a place to stay, a day-by-day schedule and a budget.

Made by **Cache Me Outside**.

## What it does

- **Plan by typing (or talking)**: describe your trip and it fills everything in
- **Day-by-day plans**: real places in 15 cities, timed around opening hours
- **Flights, stays and budget**: compare options and see where your money goes
- **Live mode**: countdowns and reminders while you travel (try the demo)
- **Explore**: browse cities by region and vibe
- **Accessible**: dark mode, easy-to-read fonts, read-aloud, works on phones

> Flights and stays are fake sample data. Nothing can actually be booked.

## How to run it

You need **Node.js** and **Python** installed.

**1. Start the backend** (from the main project folder, not inside `backend/`):

```
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

**2. Start the website** (in a second terminal):

```
cd frontend
npm install
npm run dev
```

**3. Open** http://localhost:5173

The website still works if the backend isn't running. You just get typical weather instead of real weather.

## For the backend / API team

The website uses two backend links:

| Link | What it gives back |
|---|---|
| `/health` | `{"status": "ok"}` so the site knows the backend is on |
| `/weather?location=...&start_date=...&end_date=...` | Real weather for those dates (dates look like `2026-04-11`) |

Good to know:

- Real weather needs a Geoapify key. Make a `.env` file containing `GEOAPIFY_API_KEY=your_key_here`.
- The website reads these weather fields: `temperature_2m_max`, `temperature_2m_min`, `precipitation_sum`, `sunshine_duration`. **Tell the frontend team before renaming them.**
- All the fake data (flights, stays, places, prices) lives in `frontend/src/data/` and `frontend/src/engine/`. Those are the places to plug in real APIs later.

## Built with

React + Vite (website) · FastAPI + Python (backend) · Geoapify + Open-Meteo (weather)
