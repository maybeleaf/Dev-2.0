"""
Tests for the ranker (algorith.py). Covers each edge case from the
AI weights design handoff.

Run from the repo root (no extra installs needed):
    python backend/services/test_algorith.py
Also works with pytest if it's installed.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import algorith as a  # noqa: E402

MOCK = json.loads((Path(__file__).resolve().parents[2] / "mock" / "stays.json").read_text())


def sums_to_one(weights: dict) -> bool:
    return abs(sum(weights.values()) - 1.0) < 1e-9


def names(results: list[dict]) -> list[str]:
    return [r["name"] for r in results]


# --- Piece 1: rank_stays weights input ---------------------------------------

def test_old_calls_without_weights_still_work():
    results, warning = a.rank_stays(MOCK, budget=600, nights=4, mode="cheapest")
    assert warning is None
    assert names(results) == ["Cozy Loft", "Hotel Sol"]


def test_custom_weights_change_the_order():
    results, _ = a.rank_stays(MOCK, budget=600, nights=4, weights={"price": 0.0, "rating": 1.0})
    assert names(results)[0] == "Hotel Sol"    # higher rating wins


def test_given_weights_are_cleaned_too():
    # Junk weights must not crash rank_stays.
    results, _ = a.rank_stays(MOCK, budget=600, nights=4, weights={"price": "lots", "vibes": 9})
    assert len(results) == 2


# --- Piece 2: clean_weights edge cases ---------------------------------------

def test_extra_keys_are_dropped():
    cleaned = a.clean_category({"price": 0.5, "rating": 0.5, "vibes": 0.9}, "stays")
    assert set(cleaned) == {"price", "rating"}


def test_missing_key_filled_from_closest_preset():
    # price 0.8 is closest to "cheapest", whose rating is 0.2 -> 0.8 / 0.2
    cleaned = a.clean_category({"price": 0.8}, "stays")
    assert abs(cleaned["price"] - 0.8) < 1e-9 and abs(cleaned["rating"] - 0.2) < 1e-9


def test_negative_number_is_dropped_and_filled():
    cleaned = a.clean_category({"price": -0.5, "rating": 0.8}, "stays")
    assert cleaned["price"] > 0
    assert sums_to_one(cleaned)


def test_word_values_are_mapped():
    cleaned = a.clean_category({"price": "low", "rating": "high"}, "stays")
    assert abs(cleaned["price"] - 0.2) < 1e-9 and abs(cleaned["rating"] - 0.8) < 1e-9


def test_unknown_words_fall_back_to_preset():
    cleaned = a.clean_category({"price": "kinda", "rating": "high"}, "stays")
    assert sums_to_one(cleaned) and cleaned["rating"] > cleaned["price"]


def test_weights_are_normalized_to_one():
    cleaned = a.clean_category({"price": 3, "rating": 7}, "stays")
    assert abs(cleaned["price"] - 0.3) < 1e-9 and sums_to_one(cleaned)


def test_minimum_weight_and_total_stays_one():
    cleaned = a.clean_category({"price": 0, "rating": 1}, "stays")
    assert abs(cleaned["price"] - a.MIN_WEIGHT) < 1e-9
    assert sums_to_one(cleaned)
    flights = a.clean_category({"price": 1, "stops": 0, "duration": 0}, "flights")
    assert min(flights.values()) >= a.MIN_WEIGHT - 1e-9 and sums_to_one(flights)


def test_all_zero_weights_split_evenly():
    cleaned = a.clean_category({"price": 0, "rating": 0}, "stays")
    assert abs(cleaned["price"] - 0.5) < 1e-9


def test_missing_category_becomes_balanced():
    full = a.clean_weights({"stays": {"price": 0.3, "rating": 0.7}})
    assert full["flights"] == a.PRESETS["balanced"]["flights"]
    assert a.missing_categories({"stays": {}}) == ["flights", "activities", "restaurants"]


def test_not_a_dict_at_all():
    full = a.clean_weights("the AI returned a sentence")
    assert full == {c: a.PRESETS["balanced"][c] for c in a.PRESETS["balanced"]}


# --- Price score and blending ---------------------------------------------------

def test_price_score_compares_to_budget():
    assert a.budget_price_score(0, 150) == 1.0
    assert abs(a.budget_price_score(75, 150) - 0.5) < 1e-9


def test_over_budget_gets_floor_not_negative():
    assert a.budget_price_score(180, 150) == a.PRICE_FLOOR


def test_relaxed_over_budget_stays_score_at_least_floor():
    # Budget fits nothing strictly, so the relaxed filter keeps a stay ~7% over.
    results, warning = a.rank_stays(MOCK, budget=300, nights=4, mode="cheapest")
    assert warning is not None
    assert all(r["score"] >= 0 for r in results)


def test_preset_click_averages_with_ai():
    blended = a.blend_with_preset({"stays": {"price": 0.3, "rating": 0.7}}, "cheapest")
    assert abs(blended["stays"]["price"] - 0.55) < 1e-9
    assert sums_to_one(blended["stays"])


if __name__ == "__main__":
    tests = [(n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)]
    failed = 0
    for name, func in tests:
        try:
            func()
            print(f"PASS  {name}")
        except AssertionError as err:
            failed += 1
            print(f"FAIL  {name} {err}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
