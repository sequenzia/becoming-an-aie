"""Step 1: one raw model call with a tool attached, before any abstraction.

uv run python first_call.py

This is the provider's own SDK, called directly, for whichever key is set.
The tool definition is written out here in full, in each provider's shape.
Read it before adapter.py. The adapter is this same call, wrapped once, with
the failures turned into a typed result. One call costs about one cent at
list prices checked on 2026-10-09. It prints that before it calls.

Notice what comes back: a tool name and arguments. Nothing has run. The model
proposed a call. Running it, or refusing to, is the job of your code.
"""

import json
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
    "You are the order assistant in the Cedar Support customer portal. "
    "The signed-in customer is Pellwick Dental Group. When the customer asks "
    "about an order, call lookup_order once, with the order number from their "
    "message. Do not answer in prose."
)
QUESTION = "Hi, was order ORD-10421 paid? Our accountant is asking."

DESCRIPTION = (
    "Look up one order on the signed-in customer's Cedar Support account. "
    "Order numbers are ORD- followed by five digits, for example ORD-10421. "
    "Set response_format to 'summary' for the status and total, or "
    "'line_items' when the customer asks what was on the order."
)
SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "order_id": {"type": "string"},
        "response_format": {"type": "string", "enum": ["summary", "line_items"]},
    },
    "required": ["order_id", "response_format"],
    "additionalProperties": False,
}


def call_anthropic(model: str) -> None:
    """One Messages API call with one tool. Prints the tool call and usage."""
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY
    message = client.messages.create(
        model=model,
        max_tokens=4096,
        system=SYSTEM,
        messages=[{"role": "user", "content": QUESTION}],
        output_config={"effort": "low"},
        tools=[
            {
                "name": "lookup_order",
                "description": DESCRIPTION,
                "input_schema": SCHEMA,
                "strict": True,
            }
        ],
    )
    print("stop_reason:", message.stop_reason)
    if message.stop_reason == "refusal":
        print("The model declined this request.")
        return
    for block in message.content:
        if block.type == "tool_use":
            print("tool call:", block.name, json.dumps(block.input))
        elif block.type == "text" and block.text:
            print("text:", block.text)
    print(message.model, message.usage.input_tokens, message.usage.output_tokens)


def call_openai(model: str) -> None:
    """One Responses API call with one function tool. Prints the call and usage."""
    client = openai.OpenAI()  # reads OPENAI_API_KEY
    response = client.responses.create(
        model=model,
        instructions=SYSTEM,
        input=QUESTION,
        max_output_tokens=4096,
        reasoning={"effort": "low"},
        tools=[
            {
                "type": "function",
                "name": "lookup_order",
                "description": DESCRIPTION,
                "parameters": SCHEMA,
                "strict": True,
            }
        ],
    )
    print("status:", response.status)
    for item in response.output:
        if item.type == "function_call":
            print("tool call:", item.name, item.arguments)
    if response.output_text:
        print("text:", response.output_text)
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
        "With a key, this script sends one customer message to the model with\n"
        "the lookup_order tool attached, and prints the tool call it proposes,\n"
        "the served model id, and the input and output tokens."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
