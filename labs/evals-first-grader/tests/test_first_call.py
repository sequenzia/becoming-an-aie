"""first_call.py without a key: it explains and makes no call."""

import httpx2
import openai
import pytest

import first_call
from first_call import QUESTION


def test_no_key_explains_and_exits_zero(capsys: pytest.CaptureFixture[str]) -> None:
    assert first_call.main({}) == 0
    assert "no call was made" in capsys.readouterr().out


def test_empty_keys_count_as_unset(capsys: pytest.CaptureFixture[str]) -> None:
    assert first_call.main({"ANTHROPIC_API_KEY": "", "OPENAI_API_KEY": ""}) == 0
    assert "no call was made" in capsys.readouterr().out


def test_the_question_carries_facts_and_a_customer_message() -> None:
    assert QUESTION.startswith("Facts you can see:")
    assert "no fix date yet" in QUESTION
    assert "Customer message:" in QUESTION


def test_the_cost_line_names_the_model_price_and_date() -> None:
    line = first_call.cost_line("claude-opus-5-5")
    assert line.startswith("One call to claude-opus-5-5.")
    assert f"{first_call.COST_SIZE} at list prices checked on 2026-10-09." in line
    assert "as of 2026-09-15" in first_call.cost_line("gpt-5.6-sol")
    assert "no list price" in first_call.cost_line("someone-else-1")


def test_the_cost_line_prints_before_the_call(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    seen: list[str] = []

    def fake_call(model: str) -> None:
        seen.append(capsys.readouterr().out)
        print(f"called {model}")

    monkeypatch.setattr(first_call, "call_anthropic", fake_call)
    assert (
        first_call.main({"ANTHROPIC_API_KEY": "test", "LAB_ANTHROPIC_MODEL": ""}) == 0
    )
    assert seen == [first_call.cost_line("claude-opus-5-5") + "\n"]
    assert capsys.readouterr().out == "called claude-opus-5-5\n"


def test_a_provider_error_prints_the_retry_advice(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    request = httpx2.Request("POST", "https://example.invalid")

    def failing_call(model: str) -> None:
        raise openai.APIError(f"{model} is busy", request, body=None)

    monkeypatch.setattr(first_call, "call_openai", failing_call)
    assert first_call.main({"OPENAI_API_KEY": "test"}) == 1
    out = capsys.readouterr().out
    assert "The call failed: APIError: gpt-5.6-sol is busy" in out
    assert first_call.RETRY_ADVICE in out
