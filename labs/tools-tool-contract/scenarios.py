"""The lab's inputs: the customer requests for the live step, the hand-written
fixture calls for the free step, and the system prompt.
"""

import json
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from contract import ERROR_KINDS, TOOL_NAME
from store import OrderStore

DATA = Path(__file__).parent / "data"
DEFAULT_REQUESTS = DATA / "requests.json"
DEFAULT_FIXTURE_CALLS = DATA / "fixture_calls.json"

OUTCOMES = ("accepted", *ERROR_KINDS)


class ScenarioError(ValueError):
    """A request or fixture call file is malformed."""


@dataclass(frozen=True)
class Request:
    """One customer message, sent by one signed-in customer."""

    id: str
    customer_id: str
    message: str
    expect: str


@dataclass(frozen=True)
class FixtureCall:
    """A tool call written by hand, with the verdict the validator must reach."""

    id: str
    why: str
    customer_id: str
    name: str
    arguments: object
    expect: str


def system_prompt(customer_name: str) -> str:
    """The instructions for one request. It names the customer, not an id."""
    return (
        "You are the order assistant in the Cedar Support customer portal. "
        f"The signed-in customer is {customer_name}. When the customer asks "
        f"about an order, call {TOOL_NAME} once, with the order number from "
        "their message. Do not answer in prose."
    )


def load_requests(store: OrderStore, path: Path = DEFAULT_REQUESTS) -> list[Request]:
    """The live step's requests. Refuses unknown customers and outcomes."""
    requests = [
        Request(
            id=_text(item, "id"),
            customer_id=_customer(item, store),
            message=_text(item, "message"),
            expect=_outcome(item),
        )
        for item in _items(path, "requests")
    ]
    _unique(request.id for request in requests)
    return requests


def load_fixture_calls(
    store: OrderStore, path: Path = DEFAULT_FIXTURE_CALLS
) -> list[FixtureCall]:
    """The free step's calls. The arguments are kept exactly as written."""
    calls = []
    for item in _items(path, "calls"):
        if "arguments" not in item:
            raise ScenarioError(f"Call {item.get('id')!r} has no arguments.")
        calls.append(
            FixtureCall(
                id=_text(item, "id"),
                why=_text(item, "why"),
                customer_id=_customer(item, store),
                name=_text(item, "name"),
                arguments=item["arguments"],
                expect=_outcome(item),
            )
        )
    _unique(call.id for call in calls)
    return calls


def _items(path: Path, key: str) -> list[dict[str, object]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ScenarioError(f"Cannot read {path.name}: {exc}") from exc
    items = data.get(key) if isinstance(data, dict) else None
    if not isinstance(items, list) or not items:
        raise ScenarioError(f"{path.name} needs a non-empty '{key}' list.")
    if not all(isinstance(item, dict) for item in items):
        raise ScenarioError(f"Every entry in '{key}' must be an object.")
    return items


def _text(item: dict[str, object], key: str) -> str:
    value = item.get(key)
    if not isinstance(value, str) or not value:
        raise ScenarioError(f"'{key}' must be non-empty text in {item!r}.")
    return value


def _customer(item: dict[str, object], store: OrderStore) -> str:
    customer_id = _text(item, "customer_id")
    if store.customer(customer_id) is None:
        raise ScenarioError(f"Unknown customer {customer_id!r}.")
    return customer_id


def _outcome(item: dict[str, object]) -> str:
    expect = _text(item, "expect")
    if expect not in OUTCOMES:
        raise ScenarioError(f"Unknown expected outcome {expect!r}.")
    return expect


def _unique(ids: Iterable[str]) -> None:
    seen: set[str] = set()
    for value in ids:
        if value in seen:
            raise ScenarioError(f"Duplicate id {value!r}.")
        seen.add(value)
