"""Price lookup and the cost arithmetic."""

import pytest

import adapter
from prices import (
    PRICES,
    cost_usd,
    estimate_input_tokens,
    format_dollars,
    format_price,
    lookup,
    order_of_magnitude,
)


def test_both_default_models_have_a_price() -> None:
    assert lookup(adapter.DEFAULT_ANTHROPIC_MODEL) is not None
    assert lookup(adapter.DEFAULT_OPENAI_MODEL) is not None


def test_the_previous_default_keeps_its_price() -> None:
    """LAB_ANTHROPIC_MODEL=claude-opus-5 still gets an estimate."""
    price = lookup("claude-opus-5")
    assert price is not None
    assert price.model == "claude-opus-5"


def test_every_row_names_the_day_it_was_checked() -> None:
    for price in PRICES.values():
        assert len(price.checked_on) == len("2026-10-09")
        assert price.basis in ("checked on", "as of")


def test_carried_forward_prices_say_as_of() -> None:
    assert "list price as of 2026-09-15" in format_price(PRICES["gpt-5.6-sol"])
    assert "list price checked on 2026-10-09" in format_price(PRICES["claude-opus-5"])


@pytest.mark.parametrize(
    ("served", "base"),
    [
        ("claude-opus-5", "claude-opus-5"),
        ("claude-opus-5-5", "claude-opus-5-5"),
        ("gpt-5.6-sol-2026-08-01", "gpt-5.6-sol"),
        ("claude-sonnet-5-20260801", "claude-sonnet-5"),
    ],
)
def test_lookup_matches_dated_snapshots(served: str, base: str) -> None:
    price = lookup(served)
    assert price is not None
    assert price.model == base


def test_lookup_does_not_guess_a_different_model() -> None:
    assert lookup("gpt-5.5-pro") is None
    assert lookup("claude-haiku-4-5") is None


def test_cost_arithmetic() -> None:
    price = PRICES["claude-opus-5"]
    assert cost_usd(price, 1_000_000, 0) == pytest.approx(5.00)
    assert cost_usd(price, 4_000, 4_800) == pytest.approx(0.02 + 0.12)


def test_estimate_input_tokens() -> None:
    assert estimate_input_tokens("abcd" * 25) == 25 + 10


@pytest.mark.parametrize(
    ("dollars", "words"),
    [
        (0.004, "less than one cent"),
        (0.05, "a few cents"),
        (0.14, "cents, under one dollar"),
        (3.0, "dollars, under ten"),
        (40.0, "tens of dollars or more"),
    ],
)
def test_order_of_magnitude(dollars: float, words: str) -> None:
    assert order_of_magnitude(dollars) == words


def test_format_dollars_keeps_small_amounts_visible() -> None:
    assert format_dollars(0.1384) == "$0.14"
    assert format_dollars(0.00123) == "$0.0012"


def test_the_tool_allowance_is_added_only_with_a_tool() -> None:
    plain = estimate_input_tokens("abcd" * 25)
    assert estimate_input_tokens("abcd" * 25, with_tool=True) == plain + 500
