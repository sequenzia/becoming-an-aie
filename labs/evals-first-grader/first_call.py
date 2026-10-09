"""Step 1: one raw model call, before any abstraction.

uv run python first_call.py

This is the provider's own SDK, called directly, for whichever key is set.
It asks for one support reply from a few facts, the same kind of output you
review in this lab. Read it before adapter.py. The adapter is this same call,
wrapped once, with the failures turned into a typed result. One call costs
about one cent at list prices checked on 2026-10-09. It prints that before
it calls.
"""

import os
import sys
from collections.abc import Mapping

import anthropic
import openai

import prices

COST_SIZE = "About one cent"
"""The size of one call at list price. prices.py holds the rates and dates."""
RETRY_ADVICE = (
    "Rate limit, 5xx or network: wait a few seconds and run it again. "
    "401 or 400: check the key and the model id, then run again."
)

SYSTEM = (
    "You are the support assistant for Cedar Support Software, a fictional help "
    "desk product. Use only the facts you are given. Do not state a date that is "
    "not in them. Keep the reply under 120 words."
)
QUESTION = (
    "Facts you can see:\n"
    "- Known issue: KI-212, CSV export fails above 5,000 rows\n"
    "- Known issue status: investigating, no fix date yet\n"
    "- Workaround: export by date range, under 5,000 rows each\n\n"
    "Customer message:\n"
    "CSV export has been failing for two days. When will it be fixed?"
)


def call_anthropic(model: str) -> None:
    """One Messages API call. Prints the reply, the served model, and usage."""
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY
    message = client.messages.create(
        model=model,
        max_tokens=4096,
        system=SYSTEM,
        messages=[{"role": "user", "content": QUESTION}],
        output_config={"effort": "low"},
    )
    if message.stop_reason == "refusal":
        print("The model declined this request.")
        return
    text = "".join(block.text for block in message.content if block.type == "text")
    print(text)
    print(message.model, message.usage.input_tokens, message.usage.output_tokens)


def call_openai(model: str) -> None:
    """One Responses API call. Prints the reply, the served model, and usage."""
    client = openai.OpenAI()  # reads OPENAI_API_KEY
    response = client.responses.create(
        model=model,
        instructions=SYSTEM,
        input=QUESTION,
        max_output_tokens=4096,
        reasoning={"effort": "low"},
    )
    print(response.output_text)
    usage = response.usage
    if usage is not None:
        print(response.model, usage.input_tokens, usage.output_tokens)


def cost_line(model: str) -> str:
    """The cost statement printed before the call."""
    price = prices.lookup(model)
    if price is None:
        return (
            f"One call to {model}. prices.py has no list price for it, "
            "so there is no estimate. Check the provider's pricing page."
        )
    return (
        f"One call to {model}. {COST_SIZE} at list prices "
        f"{price.basis} {price.checked_on}."
    )


def main(env: Mapping[str, str] | None = None) -> int:
    """Make one call for the key that is set. With no key, explain and exit 0."""
    environ = os.environ if env is None else env
    try:
        if environ.get("ANTHROPIC_API_KEY"):
            model = environ.get("LAB_ANTHROPIC_MODEL") or "claude-opus-5-5"
            print(cost_line(model))
            call_anthropic(model)
            return 0
        if environ.get("OPENAI_API_KEY"):
            model = environ.get("LAB_OPENAI_MODEL") or "gpt-5.6-sol"
            print(cost_line(model))
            call_openai(model)
            return 0
    except (anthropic.APIError, openai.APIError) as exc:
        print(f"The call failed: {type(exc).__name__}: {exc}")
        print(RETRY_ADVICE)
        return 1
    print(
        "No ANTHROPIC_API_KEY or OPENAI_API_KEY is set, so no call was made.\n"
        "With a key, this script sends one customer message and its facts to\n"
        "the model and prints the reply, the served model id, and the input\n"
        "and output tokens. Then ask the lab's question of it: is every date\n"
        "in the reply in the facts?"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
