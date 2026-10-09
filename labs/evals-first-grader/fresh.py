"""The model step: fresh outputs for the same grader.

Each scenario in data/scenarios.jsonl is a customer message and the facts
the assistant could see, with no reply. The model writes the reply through
adapter.complete, under the same policy the 30 reviewed outputs were held
to. Each reply is written to runs/fresh-<stamp>-<provider>-<model>.jsonl as
soon as it returns. That file is also the progress file for --resume.
"""

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from adapter import TaskFailure, TaskResult
from records import Output, Policy, Scenario, format_facts

RUNS_DIR = Path(__file__).parent / "runs"
PREFIX = "fresh-"
RESUME_COMMAND = "uv run python run.py --model --resume"

Status = Literal["answered", "failed"]


class RunFileError(ValueError):
    """A line in a run file could not be read."""


@dataclass(frozen=True)
class Record:
    """One model call for one scenario. reply is empty when the call failed."""

    id: str
    status: Status
    at: str
    reply: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    model: str = ""
    provider: str = ""
    failure_kind: str = ""
    failure_message: str = ""
    retryable: bool = False


def system_prompt(policy: Policy) -> str:
    """The assistant's instructions: who it is and the rules, numbered."""
    rules = "\n".join(f"{n}. {rule}" for n, rule in enumerate(policy.rules, 1))
    return (
        f"{policy.assistant}\n\nRules:\n{rules}\n\n"
        "Write only the reply to the customer, as plain text."
    )


def user_message(scenario: Scenario) -> str:
    """The facts the assistant can see, then the customer's message."""
    facts = "\n".join(f"- {line}" for line in format_facts(scenario.facts))
    return f"Facts you can see:\n{facts}\n\nCustomer message:\n{scenario.customer}"


def from_result(scenario_id: str, result: TaskResult, at: str) -> Record:
    """The record for a call that returned a reply."""
    return Record(
        id=scenario_id,
        status="answered",
        at=at,
        reply=result.text.strip(),
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        latency_ms=result.latency_ms,
        model=result.model,
        provider=result.provider,
    )


def from_failure(
    scenario_id: str, failure: TaskFailure, model: str, provider: str, at: str
) -> Record:
    """The record for a call that failed. It keeps the typed failure."""
    return Record(
        id=scenario_id,
        status="failed",
        at=at,
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


def answered(records: list[Record]) -> dict[str, Record]:
    """The latest answered record per scenario id. Failed calls are left out."""
    return {r.id: r for r in records if r.status == "answered"}


def outputs(path: Path, scenarios: list[Scenario]) -> list[Output]:
    """The answered replies as outputs to grade or review, in scenario order."""
    replies = answered(read(path))
    return [
        Output(id=s.id, customer=s.customer, facts=s.facts, reply=replies[s.id].reply)
        for s in scenarios
        if s.id in replies
    ]


def run_file_name(stamp: str, provider: str, model: str) -> str:
    """'fresh-<stamp>-<provider>-<model>.jsonl', safe for any file system."""
    return f"{PREFIX}{stamp}-{provider}-{_safe(model)}.jsonl"


def newest(
    runs_dir: Path, provider: str | None = None, model: str | None = None
) -> Path | None:
    """The latest run file, for one provider and model or for any."""
    if provider is None or model is None:
        pattern = f"{PREFIX}*.jsonl"
    else:
        pattern = f"{PREFIX}*-{provider}-{_safe(model)}.jsonl"
    found = sorted(runs_dir.glob(pattern))
    return found[-1] if found else None


def no_replies_message(run_path: Path) -> str:
    """What to say when the newest model run holds only failed calls."""
    return (
        f"The newest model run, {run_path.name}, has no replies yet. Its calls "
        f"failed before any reply came back. Continue it with: {RESUME_COMMAND}"
    )


def labels_path(run_path: Path, work_dir: Path) -> Path:
    """Where your labels for one run's fresh outputs live."""
    return work_dir / f"{run_path.stem}-labels.jsonl"


def _safe(model: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", model)


def _parse(line: str, number: int) -> Record:
    try:
        data = json.loads(line)
    except json.JSONDecodeError as exc:
        raise RunFileError(f"Line {number} is not JSON: {exc.msg}.") from exc
    if not isinstance(data, dict):
        raise RunFileError(f"Line {number} is not an object.")
    status = data.get("status")
    if status not in ("answered", "failed"):
        raise RunFileError(f"Line {number} has an unknown status {status!r}.")
    return Record(
        id=_text(data, "id", number),
        status="answered" if status == "answered" else "failed",
        at=_text(data, "at", number),
        reply=_text(data, "reply", number),
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
        raise RunFileError(f"Line {number}: {key} must be text.")
    return value


def _count(data: dict[str, object], key: str, number: int) -> int:
    value = data.get(key, 0)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise RunFileError(f"Line {number}: {key} must be a whole number.")
    return value


def _flag(data: dict[str, object], key: str, number: int) -> bool:
    value = data.get(key, False)
    if not isinstance(value, bool):
        raise RunFileError(f"Line {number}: {key} must be true or false.")
    return value
