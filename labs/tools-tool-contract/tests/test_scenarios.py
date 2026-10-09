"""The request file, the fixture call file, and the system prompt."""

import json
from pathlib import Path

import pytest

from report import check_fixture_calls
from scenarios import (
    ScenarioError,
    load_fixture_calls,
    load_requests,
    system_prompt,
)
from store import load_store

STORE = load_store()


def test_every_fixture_call_gets_the_verdict_it_expects() -> None:
    outcomes = check_fixture_calls(load_fixture_calls(STORE), STORE)
    wrong = [
        (o.call.id, o.call.expect, o.outcome) for o in outcomes if not o.as_expected
    ]
    assert wrong == []


def test_the_fixture_calls_cover_every_error_kind() -> None:
    expected = {call.expect for call in load_fixture_calls(STORE)}
    assert expected == {
        "accepted",
        "unknown_tool",
        "not_an_object",
        "missing_field",
        "unknown_field",
        "wrong_type",
        "not_in_enum",
        "bad_format",
        "not_found",
        "not_yours",
    }


def test_the_requests_load_and_include_another_customers_order() -> None:
    requests = load_requests(STORE)
    assert 5 <= len(requests) <= 8
    assert sum(r.expect == "not_yours" for r in requests) >= 1
    assert sum(r.expect == "accepted" for r in requests) >= 1


def test_a_request_for_an_unknown_customer_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "requests.json"
    entry = {"id": "r1", "customer_id": "cus_x", "message": "m", "expect": "accepted"}
    path.write_text(json.dumps({"requests": [entry]}), encoding="utf-8")
    with pytest.raises(ScenarioError, match="Unknown customer"):
        load_requests(STORE, path)


def test_an_unknown_expected_outcome_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "requests.json"
    entry = {"id": "r1", "customer_id": "cus_orrin", "message": "m", "expect": "ok"}
    path.write_text(json.dumps({"requests": [entry]}), encoding="utf-8")
    with pytest.raises(ScenarioError, match="Unknown expected outcome"):
        load_requests(STORE, path)


def test_duplicate_ids_are_refused(tmp_path: Path) -> None:
    path = tmp_path / "requests.json"
    entry = {
        "id": "r1",
        "customer_id": "cus_orrin",
        "message": "m",
        "expect": "accepted",
    }
    path.write_text(json.dumps({"requests": [entry, entry]}), encoding="utf-8")
    with pytest.raises(ScenarioError, match="Duplicate id"):
        load_requests(STORE, path)


def test_a_fixture_call_keeps_its_arguments_exactly(tmp_path: Path) -> None:
    path = tmp_path / "calls.json"
    entry = {
        "id": "f1",
        "why": "w",
        "customer_id": "cus_orrin",
        "name": "lookup_order",
        "arguments": ["a", 1],
        "expect": "not_an_object",
    }
    path.write_text(json.dumps({"calls": [entry]}), encoding="utf-8")
    assert load_fixture_calls(STORE, path)[0].arguments == ["a", 1]


def test_the_system_prompt_names_the_customer_and_no_id() -> None:
    prompt = system_prompt("Orrin and Shaw Architects")
    assert "Orrin and Shaw Architects" in prompt
    assert "lookup_order" in prompt
    assert "cus_" not in prompt
