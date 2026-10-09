"""The run file: one JSON line per model call, written as soon as it returns.

The run file is also the progress file. --resume reads it and skips every
request that already has a verdict, so a failure halfway costs nothing that
was already paid for.
"""

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from adapter import TaskFailure, TaskResult, ToolCall
from contract import Accepted, Rejected

Status = Literal["answered", "failed"]


class RunLogError(ValueError):
    """A run file line could not be read."""


@dataclass(frozen=True)
class Record:
    """One model call for one request.

    answered: the model made a tool call and the validator decided it.
    failed: the call failed, or the model made no tool call.
    """

    id: str
    status: Status
    at: str
    customer_id: str
    tool_name: str = ""
    arguments: dict[str, object] | None = None
    verdict: str = ""
    error_kinds: tuple[str, ...] = ()
    error_messages: tuple[str, ...] = ()
    result: dict[str, object] | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    model: str = ""
    provider: str = ""
    failure_kind: str = ""
    failure_message: str = ""
    retryable: bool = False


def from_verdict(
    request_id: str,
    customer_id: str,
    result: TaskResult,
    call: ToolCall,
    verdict: Accepted | Rejected,
    tool_result: dict[str, object],
    at: str,
) -> Record:
    """The record for a tool call the validator accepted or rejected."""
    rejected = isinstance(verdict, Rejected)
    return Record(
        id=request_id,
        status="answered",
        at=at,
        customer_id=customer_id,
        tool_name=call.name,
        arguments=dict(call.arguments),
        verdict="rejected" if rejected else "accepted",
        error_kinds=verdict.kinds if rejected else (),
        error_messages=tuple(e.message for e in verdict.errors) if rejected else (),
        result=tool_result,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        latency_ms=result.latency_ms,
        model=result.model,
        provider=result.provider,
    )


def from_failure(
    request_id: str,
    customer_id: str,
    failure: TaskFailure,
    model: str,
    provider: str,
    at: str,
) -> Record:
    """The record for a call that failed. It keeps the typed failure."""
    return Record(
        id=request_id,
        status="failed",
        at=at,
        customer_id=customer_id,
        model=model,
        provider=provider,
        failure_kind=failure.kind,
        failure_message=failure.message,
        retryable=failure.retryable,
    )


def append(path: Path, record: Record) -> None:
    """Add one record to the run file, creating it if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")


def read(path: Path) -> list[Record]:
    """Every record in a run file, in the order written."""
    records: list[Record] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            records.append(_parse(line, number))
    return records


def latest(records: list[Record]) -> dict[str, Record]:
    """The latest record per request id, answered or failed."""
    found: dict[str, Record] = {}
    for record in records:
        found[record.id] = record
    return found


def answered(records: list[Record]) -> dict[str, Record]:
    """The latest answered record per request id. Failed calls are left out."""
    found: dict[str, Record] = {}
    for record in records:
        if record.status == "answered":
            found[record.id] = record
    return found


def run_file_name(stamp: str, provider: str, model: str) -> str:
    """'<stamp>-<provider>-<model>.jsonl', safe for any file system."""
    return f"{stamp}-{provider}-{_safe(model)}.jsonl"


def newest(runs_dir: Path, provider: str, model: str) -> Path | None:
    """The latest run file for this provider and model, if there is one."""
    found = sorted(runs_dir.glob(f"*-{provider}-{_safe(model)}.jsonl"))
    return found[-1] if found else None


def _safe(model: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", model)


def _parse(line: str, number: int) -> Record:
    try:
        data = json.loads(line)
    except json.JSONDecodeError as exc:
        raise RunLogError(f"Line {number} is not JSON: {exc.msg}.") from exc
    if not isinstance(data, dict):
        raise RunLogError(f"Line {number} is not an object.")
    status = data.get("status")
    if status not in ("answered", "failed"):
        raise RunLogError(f"Line {number} has an unknown status {status!r}.")
    return Record(
        id=_text(data, "id", number),
        status="answered" if status == "answered" else "failed",
        at=_text(data, "at", number),
        customer_id=_text(data, "customer_id", number),
        tool_name=_text(data, "tool_name", number),
        arguments=_object(data, "arguments", number),
        verdict=_text(data, "verdict", number),
        error_kinds=_texts(data, "error_kinds", number),
        error_messages=_texts(data, "error_messages", number),
        result=_object(data, "result", number),
        input_tokens=_count(data, "input_tokens", number),
        output_tokens=_count(data, "output_tokens", number),
        latency_ms=_count(data, "latency_ms", number),
        model=_text(data, "model", number),
        provider=_text(data, "provider", number),
        failure_kind=_text(data, "failure_kind", number),
        failure_message=_text(data, "failure_message", number),
        retryable=_flag(data, "retryable", number),
    )


def _text(data: dict[str, object], key: str, number: int) -> str:
    value = data.get(key, "")
    if not isinstance(value, str):
        raise RunLogError(f"Line {number}: {key} must be text.")
    return value


def _texts(data: dict[str, object], key: str, number: int) -> tuple[str, ...]:
    value = data.get(key, [])
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise RunLogError(f"Line {number}: {key} must be a list of text.")
    return tuple(value)


def _object(data: dict[str, object], key: str, number: int) -> dict[str, object] | None:
    value = data.get(key)
    if value is not None and not isinstance(value, dict):
        raise RunLogError(f"Line {number}: {key} must be an object.")
    return value


def _count(data: dict[str, object], key: str, number: int) -> int:
    value = data.get(key, 0)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise RunLogError(f"Line {number}: {key} must be a whole number.")
    return value


def _flag(data: dict[str, object], key: str, number: int) -> bool:
    value = data.get(key, False)
    if not isinstance(value, bool):
        raise RunLogError(f"Line {number}: {key} must be true or false.")
    return value
