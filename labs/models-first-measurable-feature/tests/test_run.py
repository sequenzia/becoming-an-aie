"""run.py end to end, with a scripted stand-in for adapter.complete.

No test makes a model call. The stand-in returns the answers a test wants,
and fails on the calls a test wants to fail.
"""

import io
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import pytest

import runlog
from adapter import TaskFailure, TaskRequest, TaskResult
from cases import load
from run import main

CASES = load()
EXPECTED = {case.input: case.expected or case.accept[0] for case in CASES.cases}
FIXED = datetime(2026, 10, 9, 12, 0, 0, tzinfo=UTC)


def clock() -> datetime:
    return FIXED


class Scripted:
    """Answers each ticket with its expected label unless told otherwise."""

    def __init__(
        self,
        answers: dict[str, str] | None = None,
        fail_on: dict[int, TaskFailure] | None = None,
    ) -> None:
        self.answers = answers or {}
        self.fail_on = fail_on or {}
        self.requests: list[TaskRequest] = []

    def __call__(self, request: TaskRequest) -> TaskResult | TaskFailure:
        self.requests.append(request)
        number = len(self.requests)
        if number in self.fail_on:
            return self.fail_on[number]
        text = self.answers.get(request.user, EXPECTED[request.user])
        return TaskResult(
            text=text,
            input_tokens=150,
            output_tokens=120,
            latency_ms=800,
            model="claude-opus-5-5",
            provider="anthropic",
        )


def never_called(request: TaskRequest) -> TaskResult | TaskFailure:
    raise AssertionError(f"A model call was made: {request.user}")


@pytest.fixture
def anthropic_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LAB_ANTHROPIC_MODEL", raising=False)


@pytest.fixture
def no_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LAB_ANTHROPIC_MODEL", raising=False)
    monkeypatch.delenv("LAB_OPENAI_MODEL", raising=False)


def run(
    argv: list[str],
    runs_dir: Path,
    complete_fn: Callable[[TaskRequest], TaskResult | TaskFailure],
) -> tuple[int, str]:
    out = io.StringIO()
    code = main(argv, complete_fn=complete_fn, runs_dir=runs_dir, out=out, clock=clock)
    return code, out.getvalue()


@pytest.mark.usefixtures("no_keys")
def test_no_key_prints_the_plan_and_exits_zero(tmp_path: Path) -> None:
    code, text = run([], tmp_path, never_called)
    assert code == 0
    assert "Rules baseline: 19 of 24 correct (79%)" in text
    assert "24 calls." in text
    assert "claude-opus-5-5 at $4.00 input and $20.00 output" in text
    assert "gpt-5.6-sol at $4.00 input and $20.00 output" in text
    assert "checked on 2026-10-09" in text
    assert "list price as of 2026-09-15" in " ".join(text.split())
    assert "Order of magnitude: cents" in text
    assert "No ANTHROPIC_API_KEY or OPENAI_API_KEY is set" in text
    assert "uv run python first_call.py" in text
    assert not list(tmp_path.iterdir())


@pytest.mark.usefixtures("no_keys")
def test_the_real_adapter_with_no_key_still_exits_zero(tmp_path: Path) -> None:
    out = io.StringIO()
    assert main([], runs_dir=tmp_path, out=out, clock=clock) == 0
    assert "makes no call" in " ".join(out.getvalue().split())


@pytest.mark.usefixtures("anthropic_key")
def test_dry_run_stops_before_any_call(tmp_path: Path) -> None:
    code, text = run(["--dry-run"], tmp_path, never_called)
    assert code == 0
    assert "Provider: anthropic. Model: claude-opus-5-5." in text
    assert "Cost estimate: 24 calls." in text
    assert "Dry run: stopping before any paid call." in text
    assert "uv run python first_call.py" in text
    assert not list(tmp_path.iterdir())


@pytest.mark.usefixtures("anthropic_key")
def test_the_model_override_changes_the_estimate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LAB_ANTHROPIC_MODEL", "claude-sonnet-5")
    _, text = run(["--dry-run"], tmp_path, never_called)
    assert "claude-sonnet-5 at $2.00 input and $10.00 output" in text


@pytest.mark.usefixtures("anthropic_key")
def test_an_unpriced_model_says_there_is_no_estimate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LAB_ANTHROPIC_MODEL", "claude-unlisted")
    _, text = run(["--dry-run"], tmp_path, never_called)
    assert "no list price for claude-unlisted" in " ".join(text.split())


@pytest.mark.usefixtures("anthropic_key")
def test_a_full_run_writes_the_run_file_report_and_note(tmp_path: Path) -> None:
    fake = Scripted(answers={CASES.cases[0].input: "maybe billing"})
    code, text = run([], tmp_path, fake)
    assert code == 0
    assert len(fake.requests) == 24
    assert all("Answer with the category only." in r.system for r in fake.requests)
    run_file = tmp_path / "20261009T120000Z-anthropic-claude-opus-5-5.jsonl"
    records = runlog.read(run_file)
    assert len(records) == 24
    assert records[0].label is None
    assert "'maybe' is not in the label set" in records[0].rejected_reason
    assert "Model: 23 correct (96%)" in text
    assert "Rejected by the output contract: 1." in text
    assert "Served model: claude-opus-5-5 (anthropic)." in text
    note = tmp_path / "20261009T120000Z-anthropic-claude-opus-5-5-selection.md"
    assert note.exists()
    assert "23 of 24 correct" in note.read_text(encoding="utf-8")


@pytest.mark.usefixtures("anthropic_key")
def test_limit_caps_the_calls(tmp_path: Path) -> None:
    fake = Scripted()
    code, text = run(["--limit", "5"], tmp_path, fake)
    assert code == 0
    assert len(fake.requests) == 5
    assert "Cost estimate: 5 calls." in text
    assert "19 cases still without an answer" in text
    assert "Compared on 5 of 24 cases." in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_retryable_failure_stops_and_suggests_resume(tmp_path: Path) -> None:
    failure = TaskFailure("rate_limit", "Too many requests.", retryable=True)
    fake = Scripted(fail_on={4: failure})
    code, text = run([], tmp_path, fake)
    flat = " ".join(text.split())
    assert code == 1
    assert "Model call failed (rate_limit): Too many requests." in flat
    assert "again with --resume to continue from c04" in flat
    records = runlog.read(next(tmp_path.glob("*.jsonl")))
    assert [r.status for r in records] == ["answered"] * 3 + ["failed"]


@pytest.mark.usefixtures("anthropic_key")
def test_resume_skips_answered_cases(tmp_path: Path) -> None:
    failure = TaskFailure("server", "Overloaded.", retryable=True)
    run([], tmp_path, Scripted(fail_on={4: failure}))
    second = Scripted()
    code, text = run(["--resume"], tmp_path, second)
    assert code == 0
    assert len(second.requests) == 21
    assert second.requests[0].user == CASES.cases[3].input
    assert "3 of 24 cases already have an answer" in " ".join(text.split())
    assert "Compared on 24 of 24 cases." in text
    assert len(list(tmp_path.glob("*.jsonl"))) == 1


@pytest.mark.usefixtures("anthropic_key")
def test_resume_with_no_earlier_run_starts_fresh(tmp_path: Path) -> None:
    code, text = run(["--resume", "--limit", "1"], tmp_path, Scripted())
    assert code == 0
    assert "Starting a new run." in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_permanent_failure_says_to_fix_the_cause(tmp_path: Path) -> None:
    failure = TaskFailure("auth", "Invalid key.", retryable=False)
    code, text = run([], tmp_path, Scripted(fail_on={1: failure}))
    flat = " ".join(text.split())
    assert code == 1
    assert "Not retryable" in flat
    assert "Fix the cause, then run again." in flat


@pytest.mark.usefixtures("anthropic_key")
def test_a_bad_case_file_refuses_to_start(tmp_path: Path) -> None:
    bad = tmp_path / "cases.json"
    bad.write_text('{"task": "t", "categories": ["a"], "cases": []}', encoding="utf-8")
    out = io.StringIO()
    code = main([], complete_fn=never_called, cases_path=bad, out=out)
    assert code == 1
    assert out.getvalue().startswith("Cannot start:")


def test_limit_must_be_positive(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        run(["--limit", "0"], tmp_path, never_called)
