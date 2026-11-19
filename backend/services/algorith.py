"""
Lift Off — Ranking / Sorting module
Owner: Christian Chan
File: backend/services/algorith.py

PURPOSE
Takes raw search results (stays, flights, activities, restaurants) from
API_calling.py plus the user's trip request, and returns the best options
first, each with a score attached. This file makes NO API calls.

DESIGN DECISIONS (made by Christian, Nov 2026)
1. Budget: ranker always receives a PER-CATEGORY budget. If the user only
   gives a total, defaults in BUDGET_SPLIT are applied first (user can adjust).
   A category budget of 0 means "skip this category entirely."
2. Weights: scoring uses a weights dict (price / rating / interest / etc).
   For now weights come from PRESET modes: "cheapest", "balanced", "nicest".
   See IDEA below for the AI version. Likely keep both (presets = quick buttons).
3. Filter then relax: apply strict filters first. If nothing survives,
   re-run with relaxed filters and return a warning flag so the UI can say so.
4. Flights: direct flights get a bonus. 1 stop = penalty. 2+ stops are
   filtered out (except in "cheapest" mode). Layover <= 2h fine, 2-5h tapers
   down, > 5h filtered out.
5. Stays and activities are ranked independently in V1, both already filtered
   to the user's destination by the API layer.
6. Restaurants use the same scoring approach as activities, different weights.
7. Output: top_n (default 10). Frontend shows ~5 with "show more".
8. Price score (stays) compares price to the user's nightly budget:
   1 - price / budget, floored at PRICE_FLOOR for over-budget stays.
9. AI weights (approved by the team): any weights from the AI pass through
   clean_weights() first. Clicking a preset after the AI averages the two.

IDEA — proposal to discuss at the team meeting (Christian)
Before searching, let the user describe their trip in plain language
("honeymoon in Paris", "Japan trip mainly for climbing"). An AI turns that
into a weights dict (e.g. honeymoon => rating matters more than price;
sightseeing-heavy => price matters more since they're rarely in the hotel).
The ranker already accepts a weights dict, so this plugs in with no changes
here. Also affects how much restaurants/"nice dining" should matter.

V2 (stretch) — stays-near-activities scoring
Once activities are ranked, score each stay by distance to the top
activities. Needs real lat/lon in the "location" field — confirm the API
provides it before building this.
"""

from typing import Any

# ----------------------------------------------------------------------------
# 1. CONSTANTS
# ----------------------------------------------------------------------------

# Default split when the user only gives a total budget. Must sum to 1.0.
BUDGET_SPLIT = {
    "stays": 0.40,
    "flights": 0.30,
    "activities": 0.20,
    "restaurants": 0.10,
}

# Preset weight modes. Each category's weights should sum to 1.0.
# The AI step generates a dict in this same shape; clean_weights() checks it.
PRESETS = {
    "cheapest": {
        "stays":       {"price": 0.8, "rating": 0.2},
        "flights":     {"price": 0.7, "stops": 0.2, "duration": 0.1},
        "activities":  {"price": 0.6, "rating": 0.2, "interest": 0.2},
        "restaurants": {"price": 0.6, "rating": 0.2, "interest": 0.2},
    },
    "balanced": {
        "stays":       {"price": 0.5, "rating": 0.5},
        "flights":     {"price": 0.4, "stops": 0.4, "duration": 0.2},
        "activities":  {"price": 0.3, "rating": 0.3, "interest": 0.4},
        "restaurants": {"price": 0.3, "rating": 0.4, "interest": 0.3},
    },
    "nicest": {
        "stays":       {"price": 0.2, "rating": 0.8},
        "flights":     {"price": 0.2, "stops": 0.5, "duration": 0.3},
        "activities":  {"price": 0.1, "rating": 0.5, "interest": 0.4},
        "restaurants": {"price": 0.1, "rating": 0.6, "interest": 0.3},
    },
}

# Every weight is at least this after cleaning, so no factor is ever ignored
# completely. Open question: 0.01 vs 0.05. Test with real data.
MIN_WEIGHT = 0.05

# Lowest price score an item can get. Over-budget stays kept by the relaxed
# filter would otherwise score below 0. Open question: 0.05 vs 0.1.
PRICE_FLOOR = 0.05

# AI sometimes answers in words. Unknown words fall back to the preset value.
WORD_WEIGHTS = {
    "none": 0.0, "zero": 0.0,
    "very low": 0.1, "low": 0.2, "little": 0.2, "minor": 0.2,
    "medium": 0.5, "moderate": 0.5, "mid": 0.5, "average": 0.5, "some": 0.5,
    "high": 0.8, "important": 0.8, "major": 0.8, "very high": 0.9,
}

MAX_STOPS_STRICT = 1          # 2+ stops filtered out (except "cheapest")
LAYOVER_OK_MIN = 120          # <= 2h: no penalty
LAYOVER_MAX_MIN = 300         # > 5h: filtered out
DEFAULT_TOP_N = 10


# ----------------------------------------------------------------------------
# 2. HELPERS
# ----------------------------------------------------------------------------

def split_budget(total: float) -> dict[str, float]:
    """Turn a single total budget into per-category budgets using BUDGET_SPLIT."""
    return {cat: total * share for cat, share in BUDGET_SPLIT.items()}


def get_weights(mode: str, category: str) -> dict[str, float]:
    """Look up preset weights. Falls back to 'balanced' if mode is unknown."""
    return PRESETS.get(mode, PRESETS["balanced"])[category]


def normalize(values: list[float], higher_is_better: bool) -> list[float]:
    """
    Scale a list of numbers to 0..1 relative to each other.
    higher_is_better=False flips it so the smallest value scores 1.0
    (used for price, stops, duration).
    """
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi == lo:
        return [1.0] * len(values)   # all equal: nobody wins or loses
    scaled = [(v - lo) / (hi - lo) for v in values]
    return scaled if higher_is_better else [1 - s for s in scaled]


def rating_or_neutral(item: dict[str, Any]) -> float:
    """Missing rating gets a neutral 3.0 instead of dropping the item."""
    r = item.get("rating")
    return 3.0 if r is None else float(r)


def finish(items: list[dict], scores: list[float], sort_by: str, top_n: int) -> list[dict]:
    """
    Attach scores, sort, and cut to top_n.
    Returns COPIES of the items with a 'score' key added, so the shared
    contract shapes aren't modified.
    """
    scored = [{**item, "score": round(s, 4)} for item, s in zip(items, scores)]
    if sort_by == "price":
        def price_key(x: dict) -> float:
            # Explicit None checks so a free (0) item isn't treated as missing.
            for field in ("pricePerNight", "price"):
                if x.get(field) is not None:
                    return float(x[field])
            return 0.0
        scored.sort(key=price_key)
    elif sort_by == "rating":
        scored.sort(key=rating_or_neutral, reverse=True)
    else:  # "score"
        scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_n]


# ----------------------------------------------------------------------------
# 2b. WEIGHTS — cleaning (safety net for AI output) and blending with presets
# Rules decided by Christian (AI weights design, Nov 2026):
#   1. Drop keys the scoring doesn't use.
#   2. Missing key -> fill from the closest matching preset (keep AI's values).
#   3. Negative number -> dropped, then filled like a missing key.
#   4. Word values ("low"/"high") -> set numbers; unknown words -> filled.
#   5. Normalize so each category adds up to 1.
#   6. Whole category missing -> "balanced" until the user picks a preset.
#   7. Minimum weight: nothing below MIN_WEIGHT (applied after normalizing,
#      taking the difference from the other weights so the total stays 1).
# ----------------------------------------------------------------------------

def weight_to_number(value: Any) -> float | None:
    """Turn one raw weight into a usable number, or None if it can't be used."""
    if isinstance(value, bool):          # True/False are ints in Python; reject
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        text = value.strip().lower()
        if text in WORD_WEIGHTS:
            number = WORD_WEIGHTS[text]
        else:
            try:
                number = float(text)     # "0.4" as a string
            except ValueError:
                return None              # unknown word -> fill from preset
    else:
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None                      # NaN or infinity
    if number < 0:
        return None                      # rule 3: negatives are dropped
    return number


def closest_preset(known: dict[str, float], category: str) -> dict[str, float]:
    """
    The preset whose weights are nearest to the ones the AI gave us
    (smallest total difference over the keys we have). Used to fill gaps.
    """
    if not known:
        return PRESETS["balanced"][category]
    total = sum(known.values())
    # Compare on the same 0..1 scale, e.g. {"price": 3, "rating": 7} -> 0.3 / 0.7
    scaled = {k: v / total for k, v in known.items()} if total > 1 else known

    def distance(mode: str) -> float:
        preset = PRESETS[mode][category]
        return sum(abs(scaled[k] - preset[k]) for k in scaled)

    best = min(PRESETS, key=distance)
    return PRESETS[best][category]


def normalize_with_minimum(weights: dict[str, float]) -> dict[str, float]:
    """Rules 5 and 7: scale weights to add up to 1, with none below MIN_WEIGHT."""
    total = sum(weights.values())
    if total <= 0:
        # All zeros: no preference given, so split evenly.
        weights = {k: 1.0 for k in weights}
        total = float(len(weights))
    result = {k: v / total for k, v in weights.items()}

    # Raise anything under the minimum and take the difference from the rest,
    # in proportion to their size. Repeat in case that pushes another one under.
    raised: set[str] = set()
    while True:
        below = {k for k, v in result.items() if v < MIN_WEIGHT and k not in raised}
        if not below:
            return result
        raised |= below
        free = 1.0 - MIN_WEIGHT * len(raised)
        rest_total = sum(v for k, v in result.items() if k not in raised)
        result = {
            k: MIN_WEIGHT if k in raised else v / rest_total * free
            for k, v in result.items()
        }


def clean_category(raw: Any, category: str) -> dict[str, float]:
    """Apply rules 1-5 and 7 to ONE category's weights (e.g. just "stays")."""
    allowed = PRESETS["balanced"][category].keys()
    if not isinstance(raw, dict):
        return dict(PRESETS["balanced"][category])       # rule 6

    known: dict[str, float] = {}
    for key in allowed:                                   # rule 1: others ignored
        number = weight_to_number(raw.get(key))
        if number is not None:
            known[key] = number
    if not known:
        return dict(PRESETS["balanced"][category])

    preset = closest_preset(known, category)              # rules 2-4
    filled = {key: known.get(key, preset[key]) for key in allowed}
    return normalize_with_minimum(filled)                 # rules 5 and 7


def clean_weights(raw: Any) -> dict[str, dict[str, float]]:
    """
    Clean a FULL weights dict from the AI, shaped like one PRESETS entry:
    {"stays": {...}, "flights": {...}, "activities": {...}, "restaurants": {...}}
    Missing categories become "balanced" (see missing_categories()).
    """
    if not isinstance(raw, dict):
        raw = {}
    return {category: clean_category(raw.get(category), category)
            for category in PRESETS["balanced"]}


def missing_categories(raw: Any) -> list[str]:
    """Categories the AI left out, so the frontend can ask the user to pick a preset."""
    if not isinstance(raw, dict):
        return list(PRESETS["balanced"])
    return [c for c in PRESETS["balanced"] if not isinstance(raw.get(c), dict)]


def blend_with_preset(ai_weights: Any, mode: str) -> dict[str, dict[str, float]]:
    """
    User clicked a preset after the AI set weights: average each weight.
    e.g. AI stays price 0.3 + "cheapest" price 0.8 -> 0.55.
    """
    ai = clean_weights(ai_weights)
    preset = PRESETS.get(mode, PRESETS["balanced"])
    return {
        category: normalize_with_minimum({
            key: (ai[category][key] + preset[category][key]) / 2
            for key in ai[category]
        })
        for category in ai
    }


# ----------------------------------------------------------------------------
# 3. FILTERS
# Each returns the items that survive. Called strict first, then relaxed.
# ----------------------------------------------------------------------------

def filter_stays(stays: list[dict], budget: float, nights: int, relaxed: bool = False) -> list[dict]:
    """Keep stays with a known price whose total cost fits the stays budget."""
    out = []
    for s in stays:
        price = s.get("pricePerNight")
        if price is None:
            continue
        total = price * nights
        limit = budget * 1.2 if relaxed else budget   # relaxed: allow 20% over
        if total <= limit:
            out.append(s)
    return out


def filter_flights(flights: list[dict], budget: float, mode: str, relaxed: bool = False) -> list[dict]:
    """
    Strict: price <= budget, stops <= 1 (any stops in 'cheapest'),
            layover <= 5h.
    Relaxed: drop the stops/layover rules, keep price only.
    TODO: confirm field names for layover minutes in the Flight contract.
    """
    # TODO: implement
    return [f for f in flights if f.get("price") is not None and f["price"] <= budget]


def filter_activities(activities: list[dict], budget: float, relaxed: bool = False) -> list[dict]:
    """Keep activities with price <= budget. Free activities (price 0) always pass."""
    # TODO: implement
    return activities


def filter_restaurants(restaurants: list[dict], budget: float, relaxed: bool = False) -> list[dict]:
    """
    Restaurants use priceLevel (1-4) not a dollar price.
    TODO: decide how to map priceLevel to the restaurants budget.
    """
    # TODO: implement
    return restaurants


# ----------------------------------------------------------------------------
# 4. SCORING
# Each returns one score per item, 0..1, using the weights dict.
# ----------------------------------------------------------------------------

def budget_price_score(price: float, budget: float) -> float:
    """
    How cheap something is compared to the user's BUDGET (not to the other
    results, which blew tiny dollar differences up into huge score gaps).
    Free = 1.0, half the budget = 0.5; on or over budget = PRICE_FLOOR.
    """
    if budget <= 0:
        return PRICE_FLOOR
    return min(1.0, max(PRICE_FLOOR, 1 - price / budget))


def score_stays(stays: list[dict], weights: dict[str, float], nightly_budget: float) -> list[float]:
    price_scores = [budget_price_score(s["pricePerNight"], nightly_budget) for s in stays]
    rating_scores = normalize([rating_or_neutral(s) for s in stays], higher_is_better=True)
    # .get() so a weights dict missing a key (e.g. AI-generated) doesn't crash.
    return [
        weights.get("price", 0) * p + weights.get("rating", 0) * r
        for p, r in zip(price_scores, rating_scores)
    ]


def score_flights(flights: list[dict], weights: dict[str, float]) -> list[float]:
    """
    Factors: price (lower better), stops (0 is best, big bonus for direct),
    duration (lower better). Layover 2-5h should taper the score down.
    TODO: implement
    """
    return [0.0] * len(flights)


def interest_match(item: dict, interests: list[str]) -> float:
    """
    0..1 for how well an item matches the user's interests.
    V1: simple keyword check on category/name/cuisine.
    TODO: implement. Later could be AI-based.
    """

    if not interests:
        return 0.0
    text = " ".join(str(item.get(f)) for f in ("name", "category", "cuisine", "description") if item.get(f)).lower()
    hits = sum(1 for i in interests if i.lower().strip() in text)
    return 1.0 if hits > 0 else 0.0

    
def score_activities(activities: list[dict], weights: dict[str, float], interests: list[str]) -> list[float]:
    """Factors: price, rating, interest match. TODO: implement"""
    return [0.0] * len(activities)


def score_restaurants(restaurants: list[dict], weights: dict[str, float], interests: list[str]) -> list[float]:
    """Same idea as activities. priceLevel instead of price. TODO: implement"""
    return [0.0] * len(restaurants)


# ----------------------------------------------------------------------------
# 5. PUBLIC FUNCTIONS — these are what the rest of the backend calls
# Each returns (results, warning). warning is None or a short string.
# ----------------------------------------------------------------------------

def rank_stays(
    stays: list[dict],
    budget: float,
    nights: int,
    mode: str = "balanced",
    sort_by: str = "score",
    top_n: int = DEFAULT_TOP_N,
    weights: dict[str, float] | None = None,
) -> tuple[list[dict], str | None]:
    """
    FULLY IMPLEMENTED — use as the template for the others.
    budget is the STAYS share of the budget, not the trip total.
    weights: optional stays weights, e.g. {"price": 0.3, "rating": 0.7}
             (from the AI). None = use the preset for `mode`, like before.
    """
    if budget <= 0:
        return [], None   # user opted out of this category
    if nights < 1:
        # Otherwise total cost is 0 and every stay "fits" the budget.
        return [], "Trip must be at least 1 night."
    if not stays:
        return [], "No stays found."

    warning = None
    kept = filter_stays(stays, budget, nights)
    if not kept:
        kept = filter_stays(stays, budget, nights, relaxed=True)
        warning = "No stays fit your budget exactly; showing closest options."
    if not kept:
        return [], "No stays found for this budget."

    if weights is None:
        stay_weights = get_weights(mode, "stays")
    else:
        # Given weights still go through the safety net (AI can break rules).
        stay_weights = clean_category(weights, "stays")

    scores = score_stays(kept, stay_weights, nightly_budget=budget / nights)
    return finish(kept, scores, sort_by, top_n), warning


def rank_flights(flights, budget, mode="balanced", sort_by="score", top_n=DEFAULT_TOP_N):
    """TODO: same pattern as rank_stays using filter_flights / score_flights."""
    if budget <= 0:
        return [], None
    # TODO: implement
    return [], None


def rank_activities(activities, budget, interests, mode="balanced", sort_by="score", top_n=DEFAULT_TOP_N):
    """TODO: same pattern. interests comes from TripRequest.interests."""
    if budget <= 0:
        return [], None
    # TODO: implement
    return [], None


def rank_restaurants(restaurants, budget, interests, mode="balanced", sort_by="score", top_n=DEFAULT_TOP_N):
    """TODO: same pattern."""
    if budget <= 0:
        return [], None
    # TODO: implement
    return [], None


# ----------------------------------------------------------------------------
# 6. QUICK MANUAL TEST — run this file directly (from any folder):
#    python backend/services/algorith.py
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    import json
    from pathlib import Path

    # Resolve relative to this file so it works from any working directory.
    mock_path = Path(__file__).resolve().parents[2] / "mock" / "stays.json"
    with open(mock_path) as f:
        mock_stays = json.load(f)

    results, warn = rank_stays(mock_stays, budget=600, nights=4, mode="cheapest")
    print("warning:", warn)
    for r in results:
        print(r["name"], "| $", r["pricePerNight"], "| rating", r.get("rating"), "| score", r["score"])