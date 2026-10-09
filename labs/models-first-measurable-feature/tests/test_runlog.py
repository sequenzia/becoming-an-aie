"""The run file, which is also the progress file for --resume."""

from pathlib import Path

import pytest

from adapter import TaskFailure, TaskResult
from runlog import (
    Record,
    RunLogError,
    answered,
    append,
    from_failure,
    from_result,
    newest,
    read,
    run_file_name,
)
from task import Rejected

AT = "2026-10-09T12:00:00+00:00"
RESULT = TaskResult(
    text="billing",
    input_tokens=150,
    output_tokens=90,
    latency_ms=1200,
    model="claude-opus-5",
    provider="anthropic",
)


def test_records_round_trip(tmp_path: Path) -> None:
    path = tmp_path / "runs" / "run.jsonl"
    good = from_result("c01", RESULT, "billing", passed=True, at=AT)
    bad = from_result(
        "c02", RESULT, Rejected(raw="maybe", reason="nope"), passed=False, at=AT
    )
    failed = from_failure(
        "c03", TaskFailure("server", "busy", retryable=True), "m", "openai", AT
    )
    for record in (good, bad, failed):
        append(path, record)
    assert read(path) == [good, bad, failed]
    assert bad.label is None
    assert bad.rejected_reason == "nope"
    assert failed.failure_kind == "server"


def test_a_rejected_answer_never_passes() -> None:
    record = from_result("c01", RESULT, Rejected(raw="x", reason="r"), True, AT)
    assert record.passed is False


def test_answered_keeps_the_latest_answer_and_skips_failures() -> None:
    first = Record(id="c01", status="answered", at=AT, label="bug")
    failed = Record(id="c02", status="failed", at=AT, failure_kind="network")
    second = Record(id="c01", status="answered", at=AT, label="billing")
    latest = answered([first, failed, second])
    assert set(latest) == {"c01"}
    assert latest["c01"].label == "billing"


def test_newest_picks_the_latest_run_for_the_same_model(tmp_path: Path) -> None:
    older = tmp_path / run_file_name("20261009T100000Z", "anthropic", "claude-opus-5")
    newer = tmp_path / run_file_name("20261009T110000Z", "anthropic", "claude-opus-5")
    other = tmp_path / run_file_name("20261009T120000Z", "openai", "gpt-5.6-sol")
    for path in (older, newer, other):
        path.write_text("", encoding="utf-8")
    assert newest(tmp_path, "anthropic", "claude-opus-5") == newer
    assert newest(tmp_path, "anthropic", "claude-sonnet-5") is None


def test_run_file_names_are_safe() -> None:
    assert run_file_name("s", "openai", "org/model:1") == "s-openai-org_model_1.jsonl"


@pytest.mark.parametrize(
    "line",
    [
        "not json",
        "[1]",
        '{"id": "c01", "status": "maybe", "at": ""}',
        '{"id": "c01", "status": "answered", "at": "", "input_tokens": -1}',
        '{"id": "c01", "status": "answered", "at": "", "passed": "yes"}',
        '{"id": "c01", "status": "answered", "at": "", "label": 3}',
        '{"id": 1, "status": "answered", "at": ""}',
    ],
)
def test_a_bad_line_is_reported(tmp_path: Path, line: str) -> None:
    path = tmp_path / "run.jsonl"
    path.write_text(line + "\n", encoding="utf-8")
    with pytest.raises(RunLogError, match="Line 1"):
        read(path)
