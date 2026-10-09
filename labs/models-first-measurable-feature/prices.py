"""List prices and the cost arithmetic. Every dollar figure names its date.

Anthropic rows come from the claude-api skill's model table (cached
2026-10-06), checked on 2026-10-09. OpenAI rows come from the OpenAI pricing
page as read on 2026-09-15 and were not re-checked: the models endpoint that
would confirm them needs a key. Prices change. Check the provider's pricing
page before you trust a figure here.
"""

import math
import re
from dataclasses import dataclass

ANTHROPIC_CHECKED_ON = "2026-10-09"
OPENAI_CHECKED_ON = "2026-09-15"

ESTIMATED_OUTPUT_TOKENS = 200
"""Per call, including reasoning tokens. A one-word answer at low effort."""

PROMPT_OVERHEAD_TOKENS = 10
"""Per call, for the message framing the provider adds around the text."""

_DATE_SUFFIX = re.compile(r"-(\d{8}|\d{4}-\d{2}-\d{2})$")


@dataclass(frozen=True)
class Price:
    """List price in US dollars per million tokens, with the day it was read."""

    model: str
    input_per_million: float
    output_per_million: float
    checked_on: str
    basis: str = "checked on"
    """'checked on' when verified that day, 'as of' when carried forward."""


PRICES: dict[str, Price] = {
    price.model: price
    for price in (
        Price("claude-opus-5", 5.00, 25.00, ANTHROPIC_CHECKED_ON),
        Price("claude-opus-5-5", 4.00, 20.00, ANTHROPIC_CHECKED_ON),
        Price("claude-sonnet-5", 2.00, 10.00, ANTHROPIC_CHECKED_ON),
        Price("claude-sonnet-5-5", 2.00, 10.00, ANTHROPIC_CHECKED_ON),
        Price("gpt-5.6-sol", 4.00, 20.00, OPENAI_CHECKED_ON, "as of"),
        Price("gpt-5.5", 5.00, 30.00, OPENAI_CHECKED_ON, "as of"),
        Price("gpt-5-mini", 0.25, 2.00, OPENAI_CHECKED_ON, "as of"),
    )
}


def lookup(model: str) -> Price | None:
    """The price row for a model id. A dated snapshot id matches its base id."""
    if model in PRICES:
        return PRICES[model]
    return PRICES.get(_DATE_SUFFIX.sub("", model))


def cost_usd(price: Price, input_tokens: int, output_tokens: int) -> float:
    """Dollars for a token count at list price."""
    return (
        input_tokens * price.input_per_million
        + output_tokens * price.output_per_million
    ) / 1_000_000


def estimate_input_tokens(text: str) -> int:
    """A rough count: four characters per token, plus framing."""
    return math.ceil(len(text) / 4) + PROMPT_OVERHEAD_TOKENS


def order_of_magnitude(dollars: float) -> str:
    """A plain-language size for a dollar amount."""
    if dollars < 0.01:
        return "less than one cent"
    if dollars < 0.10:
        return "a few cents"
    if dollars < 1.00:
        return "cents, under one dollar"
    if dollars < 10.00:
        return "dollars, under ten"
    return "tens of dollars or more"


def format_price(price: Price) -> str:
    """'$5.00 input and $25.00 output per million tokens, list price ...'."""
    return (
        f"${price.input_per_million:.2f} input and "
        f"${price.output_per_million:.2f} output per million tokens, "
        f"list price {price.basis} {price.checked_on}"
    )


def format_dollars(dollars: float) -> str:
    """Two decimals above a cent, four below, so small runs do not read $0.00."""
    if dollars >= 0.01:
        return f"${dollars:.2f}"
    return f"${dollars:.4f}"
