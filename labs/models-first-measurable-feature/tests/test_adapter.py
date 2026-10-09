"""The adapter's non-model paths. No key, no network."""

from types import SimpleNamespace

import httpx2
import pytest

import adapter
from adapter import (
    TaskFailure,
    TaskRequest,
    TaskResult,
    ToolCall,
    ToolSpec,
    _finish,
    complete,
    explain,
    pick_provider,
)

TOOL = ToolSpec(
    name="create_ticket",
    description="Create a ticket.",
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
)


@pytest.fixture
def no_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)


def test_anthropic_wins_when_both_keys_are_set() -> None:
    env = {"ANTHROPIC_API_KEY": "test", "OPENAI_API_KEY": "test"}
    assert pick_provider(env) == "anthropic"


def test_openai_is_the_fallback() -> None:
    assert pick_provider({"OPENAI_API_KEY": "test"}) == "openai"


def test_empty_values_count_as_unset() -> None:
    assert pick_provider({"ANTHROPIC_API_KEY": "", "OPENAI_API_KEY": ""}) is None


@pytest.mark.usefixtures("no_keys")
def test_no_key_returns_the_typed_failure() -> None:
    result = complete(TaskRequest(system="s", user="u"))
    assert isinstance(result, TaskFailure)
    assert result.kind == "no_api_key"
    assert result.retryable is False


@pytest.mark.usefixtures("no_keys")
def test_empty_key_values_also_return_no_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    result = complete(TaskRequest(system="s", user="u"))
    assert isinstance(result, TaskFailure)
    assert result.kind == "no_api_key"


def test_finish_flags_a_missing_tool_call() -> None:
    result = _finish(
        TaskRequest(system="s", user="u", tool=TOOL),
        text="I made the ticket.",
        tool_call=None,
        input_tokens=1,
        output_tokens=1,
        latency_ms=1,
        model="m",
        provider="anthropic",
    )
    assert isinstance(result, TaskFailure)
    assert result.kind == "no_tool_call"
    assert result.retryable is True


def test_finish_carries_the_tool_call() -> None:
    call = ToolCall(name="create_ticket", arguments={"title": "Export fails"})
    result = _finish(
        TaskRequest(system="s", user="u", tool=TOOL),
        text="",
        tool_call=call,
        input_tokens=3,
        output_tokens=4,
        latency_ms=5,
        model="m",
        provider="openai",
    )
    assert isinstance(result, TaskResult)
    assert result.tool_call == call
    assert (result.input_tokens, result.output_tokens, result.latency_ms) == (3, 4, 5)


def test_finish_flags_empty_text() -> None:
    result = _finish(
        TaskRequest(system="s", user="u"),
        text="",
        tool_call=None,
        input_tokens=1,
        output_tokens=0,
        latency_ms=1,
        model="m",
        provider="anthropic",
    )
    assert isinstance(result, TaskFailure)
    assert result.kind == "empty"


def test_finish_returns_text_and_identity() -> None:
    result = _finish(
        TaskRequest(system="s", user="u"),
        text="billing",
        tool_call=None,
        input_tokens=10,
        output_tokens=2,
        latency_ms=900,
        model="claude-opus-5-5",
        provider="anthropic",
    )
    assert result == TaskResult(
        text="billing",
        input_tokens=10,
        output_tokens=2,
        latency_ms=900,
        model="claude-opus-5-5",
        provider="anthropic",
    )


def test_explain_says_retryable_only_for_retryable_failures() -> None:
    retry = explain(TaskFailure("rate_limit", "slow down", retryable=True))
    stop = explain(TaskFailure("auth", "bad key", retryable=False))
    assert "(rate_limit)" in retry
    assert "Retryable" in retry
    assert "Not retryable" in stop
    assert "Retryable:" not in stop


class FakeEndpoint:
    """Stands in for client.messages or client.responses. No network."""

    def __init__(self, reply: object = None, error: Exception | None = None) -> None:
        self.reply = reply
        self.error = error
        self.kwargs: dict[str, object] = {}

    def create(self, **kwargs: object) -> object:
        self.kwargs = kwargs
        if self.error is not None:
            raise self.error
        return self.reply


def fake_anthropic(
    monkeypatch: pytest.MonkeyPatch, endpoint: FakeEndpoint
) -> FakeEndpoint:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    client = SimpleNamespace(messages=endpoint)
    monkeypatch.setattr(adapter.anthropic, "Anthropic", lambda: client)
    return endpoint


def fake_openai(
    monkeypatch: pytest.MonkeyPatch, endpoint: FakeEndpoint
) -> FakeEndpoint:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    client = SimpleNamespace(responses=endpoint)
    monkeypatch.setattr(adapter.openai, "OpenAI", lambda: client)
    return endpoint


REQUEST = httpx2.Request("POST", "https://example.invalid")


def openai_reply(output: list[SimpleNamespace]) -> SimpleNamespace:
    return SimpleNamespace(
        status="completed",
        incomplete_details=None,
        output=output,
        output_text="",
        usage=None,
        model="gpt-5.6-sol",
    )


def test_malformed_tool_arguments_are_a_typed_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    call = SimpleNamespace(type="function_call", name=TOOL.name, arguments="{bad")
    fake_openai(monkeypatch, FakeEndpoint(reply=openai_reply([call])))
    result = complete(TaskRequest(system="s", user="u", tool=TOOL))
    assert isinstance(result, TaskFailure)
    assert result.kind == "no_tool_call"
    assert result.retryable is True
    assert "malformed tool arguments" in result.message


def test_another_openai_error_is_a_typed_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    error = adapter.openai.APIError("odd response", REQUEST, body=None)
    fake_openai(monkeypatch, FakeEndpoint(error=error))
    result = complete(TaskRequest(system="s", user="u"))
    assert isinstance(result, TaskFailure)
    assert result.kind == "bad_request"
    assert result.retryable is False
    assert "APIError: odd response" in result.message


def test_another_anthropic_error_is_a_typed_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    error = adapter.anthropic.APIError("odd response", REQUEST, body=None)
    fake_anthropic(monkeypatch, FakeEndpoint(error=error))
    result = complete(TaskRequest(system="s", user="u"))
    assert isinstance(result, TaskFailure)
    assert result.kind == "bad_request"


def test_an_empty_model_variable_counts_as_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LAB_ANTHROPIC_MODEL", "")
    monkeypatch.setenv("LAB_OPENAI_MODEL", "")
    reply = SimpleNamespace(
        stop_reason="end_turn",
        content=[SimpleNamespace(type="text", text="billing")],
        usage=SimpleNamespace(input_tokens=1, output_tokens=1),
        model="claude-opus-5-5",
    )
    endpoint = fake_anthropic(monkeypatch, FakeEndpoint(reply=reply))
    assert isinstance(complete(TaskRequest(system="s", user="u")), TaskResult)
    assert endpoint.kwargs["model"] == adapter.DEFAULT_ANTHROPIC_MODEL
    message = SimpleNamespace(type="message", content=[])
    endpoint = fake_openai(monkeypatch, FakeEndpoint(reply=openai_reply([message])))
    complete(TaskRequest(system="s", user="u"))
    assert endpoint.kwargs["model"] == adapter.DEFAULT_OPENAI_MODEL
