"""Thin model adapter for the labs. Provider-specific code lives only here.

Every lab carries an identical copy of this file. The canonical copy is
labs/models-first-measurable-feature/adapter.py. Verified against
anthropic 1.13.0 and openai 3.27.0 on 2026-10-09. First verified against
anthropic 1.6.0 and openai 3.14.1 on 2026-09-15.

Changed on 2026-10-09 after review: malformed tool arguments and any other
SDK error now return a typed failure, and an empty LAB_ANTHROPIC_MODEL or
LAB_OPENAI_MODEL counts as unset. Run labs/check_adapter_copies.sh after
any edit to keep the three copies identical.
"""

import json
import os
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

import anthropic
import openai
from anthropic.types import ToolParam
from openai.types.responses import FunctionToolParam

Provider = Literal["anthropic", "openai"]
FailureKind = Literal[
    "no_api_key",
    "auth",
    "rate_limit",
    "server",
    "network",
    "bad_request",
    "refusal",
    "truncated",
    "no_tool_call",
    "empty",
]

DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5"
DEFAULT_OPENAI_MODEL = "gpt-5.6-sol"


@dataclass(frozen=True)
class ToolSpec:
    """One tool the model may call. input_schema is plain JSON Schema."""

    name: str
    description: str
    input_schema: dict[str, object]


@dataclass(frozen=True)
class TaskRequest:
    """What a lab asks the model to do."""

    system: str
    user: str
    max_tokens: int = 4096
    temperature: float | None = None
    tool: ToolSpec | None = None


@dataclass(frozen=True)
class ToolCall:
    """A tool call the model produced. Arguments are already parsed."""

    name: str
    arguments: dict[str, object]


@dataclass(frozen=True)
class TaskResult:
    """A successful call."""

    text: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    model: str
    provider: Provider
    tool_call: ToolCall | None = None


@dataclass(frozen=True)
class TaskFailure:
    """A failed call. Labs print this and never show a stack trace."""

    kind: FailureKind
    message: str
    retryable: bool


def pick_provider(env: Mapping[str, str]) -> Provider | None:
    """Anthropic wins when both keys are set. Empty values count as unset."""
    if env.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if env.get("OPENAI_API_KEY"):
        return "openai"
    return None


def complete(request: TaskRequest) -> TaskResult | TaskFailure:
    """Run one request against the provider that has a key. Never raises."""
    provider = pick_provider(os.environ)
    if provider is None:
        return TaskFailure(
            kind="no_api_key",
            message="No ANTHROPIC_API_KEY or OPENAI_API_KEY in the environment.",
            retryable=False,
        )
    if provider == "anthropic":
        return _complete_anthropic(request)
    return _complete_openai(request)


def explain(failure: TaskFailure) -> str:
    """One line a lab prints when a call fails."""
    advice = (
        "Retryable: wait a few seconds and run the same command again."
        if failure.retryable
        else "Not retryable: fix the cause and run again."
    )
    return f"Model call failed ({failure.kind}): {failure.message} {advice}"


def _complete_anthropic(request: TaskRequest) -> TaskResult | TaskFailure:
    model = os.environ.get("LAB_ANTHROPIC_MODEL") or DEFAULT_ANTHROPIC_MODEL
    client = anthropic.Anthropic()
    tools: list[ToolParam] = []
    if request.tool is not None:
        tools.append(
            {
                "name": request.tool.name,
                "description": request.tool.description,
                "input_schema": request.tool.input_schema,
                "strict": True,
            }
        )
    started = time.perf_counter()
    try:
        message = client.messages.create(
            model=model,
            max_tokens=request.max_tokens,
            system=request.system,
            messages=[{"role": "user", "content": request.user}],
            output_config={"effort": "low"},
            tools=tools or anthropic.omit,
        )
    except anthropic.AuthenticationError as exc:
        return TaskFailure("auth", str(exc), retryable=False)
    except anthropic.RateLimitError as exc:
        return TaskFailure("rate_limit", str(exc), retryable=True)
    except anthropic.APIStatusError as exc:
        if exc.status_code >= 500:
            return TaskFailure("server", str(exc), retryable=True)
        return TaskFailure("bad_request", str(exc), retryable=False)
    except anthropic.APIConnectionError as exc:
        return TaskFailure("network", str(exc), retryable=True)
    except anthropic.APIError as exc:
        return TaskFailure("bad_request", _other_error(exc), retryable=False)
    latency_ms = round((time.perf_counter() - started) * 1000)
    if message.stop_reason == "refusal":
        return TaskFailure(
            "refusal", "The model declined this request.", retryable=False
        )
    if message.stop_reason == "max_tokens":
        return TaskFailure(
            "truncated", "Output hit max_tokens. Raise max_tokens.", retryable=False
        )
    text = "".join(block.text for block in message.content if block.type == "text")
    tool_call: ToolCall | None = None
    for block in message.content:
        if block.type == "tool_use":
            tool_call = ToolCall(name=block.name, arguments=block.input)
    return _finish(
        request,
        text=text,
        tool_call=tool_call,
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
        latency_ms=latency_ms,
        model=message.model,
        provider="anthropic",
    )


def _complete_openai(request: TaskRequest) -> TaskResult | TaskFailure:
    model = os.environ.get("LAB_OPENAI_MODEL") or DEFAULT_OPENAI_MODEL
    client = openai.OpenAI()
    tools: list[FunctionToolParam] = []
    if request.tool is not None:
        tools.append(
            {
                "type": "function",
                "name": request.tool.name,
                "description": request.tool.description,
                "parameters": request.tool.input_schema,
                "strict": True,
            }
        )
    temperature = openai.omit if request.temperature is None else request.temperature
    started = time.perf_counter()
    try:
        response = client.responses.create(
            model=model,
            instructions=request.system,
            input=request.user,
            max_output_tokens=request.max_tokens,
            reasoning={"effort": "low"},
            temperature=temperature,
            tools=tools or openai.omit,
        )
    except openai.AuthenticationError as exc:
        return TaskFailure("auth", str(exc), retryable=False)
    except openai.RateLimitError as exc:
        return TaskFailure("rate_limit", str(exc), retryable=True)
    except openai.APIStatusError as exc:
        if exc.status_code >= 500:
            return TaskFailure("server", str(exc), retryable=True)
        return TaskFailure("bad_request", str(exc), retryable=False)
    except openai.APIConnectionError as exc:
        return TaskFailure("network", str(exc), retryable=True)
    except openai.APIError as exc:
        return TaskFailure("bad_request", _other_error(exc), retryable=False)
    latency_ms = round((time.perf_counter() - started) * 1000)
    if response.status == "incomplete":
        details = response.incomplete_details
        reason = details.reason if details is not None else "unknown"
        return TaskFailure(
            "truncated", f"Response incomplete: {reason}.", retryable=False
        )
    tool_call: ToolCall | None = None
    for item in response.output:
        if item.type == "message":
            for part in item.content:
                if part.type == "refusal":
                    return TaskFailure("refusal", part.refusal, retryable=False)
        if item.type == "function_call":
            try:
                parsed = json.loads(item.arguments)
            except json.JSONDecodeError:
                return TaskFailure(
                    "no_tool_call",
                    "The model returned malformed tool arguments.",
                    retryable=True,
                )
            arguments = parsed if isinstance(parsed, dict) else {}
            tool_call = ToolCall(name=item.name, arguments=arguments)
    usage = response.usage
    return _finish(
        request,
        text=response.output_text,
        tool_call=tool_call,
        input_tokens=usage.input_tokens if usage is not None else 0,
        output_tokens=usage.output_tokens if usage is not None else 0,
        latency_ms=latency_ms,
        model=response.model,
        provider="openai",
    )


def _other_error(exc: Exception) -> str:
    """An SDK error that is not a status or connection error, in one line."""
    return f"{type(exc).__name__}: {exc}"


def _finish(
    request: TaskRequest,
    *,
    text: str,
    tool_call: ToolCall | None,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    model: str,
    provider: Provider,
) -> TaskResult | TaskFailure:
    """Checks shared by both providers, then the result."""
    if request.tool is not None and tool_call is None:
        return TaskFailure(
            "no_tool_call",
            "The model answered in text instead of calling the tool.",
            retryable=True,
        )
    if not text and tool_call is None:
        return TaskFailure("empty", "The model returned no text.", retryable=True)
    return TaskResult(
        text=text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        model=model,
        provider=provider,
        tool_call=tool_call,
    )
