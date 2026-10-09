"""The run file, which is also the progress file."""

from pathlib import Path

import pytest

import runlog
from adapter import TaskFailure, TaskResult, ToolCall
from contract import TOOL_NAME, Rejected, Session, validate
from executor import error_result
from store import load_store

STORE = load_store()
RESULT = TaskResult(
    text="",
    input_tokens=700,
    output_tokens=90,
    latency_ms=1500,
    model="claude-opus-5",
    provider="anthropic",
)


def rejected_record() -> runlog.Record:
    call = ToolCall(TOOL_NAME, {"order_id": "ORD-20877", "response_format": "summary"})
    verdict = validate(call.name, call.arguments, Session("cus_pellwick"), STORE)
    assert isinstance(verdict, Rejected)
    return runlog.from_verdict(
        "r3",
        "cus_pellwick",
        RESULT,
        call,
        verdict,
        error_result(verdict),
        "2026-10-09T12:00:00+00:00",
    )


def test_a_rejected_call_round_trips(tmp_path: Path) -> None:
    path = tmp_path / "run.jsonl"
    record = rejected_record()
    runlog.append(path, record)
    assert runlog.read(path) == [record]
    assert record.verdict == "rejected"
    assert record.error_kinds == ("not_yours",)
    assert record.arguments == {"order_id": "ORD-20877", "response_format": "summary"}


def test_a_failure_round_trips_and_is_not_answered(tmp_path: Path) -> None:
    path = tmp_path / "run.jsonl"
    failure = TaskFailure("no_tool_call", "Prose.", retryable=True)
    runlog.append(
        path,
        runlog.from_failure("r1", "cus_pellwick", failure, "m", "anthropic", "t"),
    )
    records = runlog.read(path)
    assert records[0].failure_kind == "no_tool_call"
    assert records[0].retryable is True
    assert runlog.answered(records) == {}
    assert set(runlog.latest(records)) == {"r1"}


def test_newest_finds_the_latest_file_for_the_model(tmp_path: Path) -> None:
    for stamp in ("20261009T100000Z", "20261009T110000Z"):
        name = runlog.run_file_name(stamp, "openai", "gpt-5.6-sol")
        (tmp_path / name).write_text("", encoding="utf-8")
    found = runlog.newest(tmp_path, "openai", "gpt-5.6-sol")
    assert found is not None
    assert found.name.startswith("20261009T110000Z")
    assert runlog.newest(tmp_path, "anthropic", "claude-opus-5") is None


def test_model_ids_are_made_safe_for_file_names() -> None:
    assert runlog.run_file_name("s", "openai", "ft:a/b") == "s-openai-ft_a_b.jsonl"


@pytest.mark.parametrize(
    ("line", "message"),
    [
        ("not json", "not JSON"),
        ("[1]", "not an object"),
        ('{"status": "maybe"}', "unknown status"),
        ('{"status": "failed", "id": 3}', "id must be text"),
        ('{"status": "answered", "id": "r", "arguments": [1]}', "must be an object"),
        ('{"status": "answered", "id": "r", "error_kinds": "x"}', "list of text"),
    ],
)
def test_a_broken_line_is_reported(tmp_path: Path, line: str, message: str) -> None:
    path = tmp_path / "run.jsonl"
    path.write_text(line + "\n", encoding="utf-8")
    with pytest.raises(runlog.RunLogError, match=message):
        runlog.read(path)
