"""run.py end to end, with a scripted stand-in for adapter.complete.

No test makes a model call. The stand-in returns the tool call a test wants,
and fails on the calls a test wants to fail.
"""

import io
import re
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import pytest

import runlog
from adapter import TaskFailure, TaskRequest, TaskResult, ToolCall
from run import main
from scenarios import load_requests
from store import load_store

REQUESTS = load_requests(load_store())
FIXED = datetime(2026, 10, 9, 12, 0, 0, tzinfo=UTC)
RUN_FILE = "20261009T120000Z-anthropic-claude-opus-5-5.jsonl"


def clock() -> datetime:
    return FIXED


class Scripted:
    """Calls lookup_order with the order number in the message, like a model."""

    def __init__(
        self,
        arguments: dict[str, dict[str, object]] | None = None,
        fail_on: dict[int, TaskFailure] | None = None,
    ) -> None:
        self.arguments = arguments or {}
        self.fail_on = fail_on or {}
        self.requests: list[TaskRequest] = []

    def __call__(self, request: TaskRequest) -> TaskResult | TaskFailure:
        self.requests.append(request)
        number = len(self.requests)
        if number in self.fail_on:
            return self.fail_on[number]
        found = re.search(r"ORD-\d+", request.user)
        arguments = self.arguments.get(
            request.user,
            {
                "order_id": found.group(0) if found else "",
                "response_format": "summary",
            },
        )
        return TaskResult(
            text="",
            input_tokens=800,
            output_tokens=120,
            latency_ms=900,
            model="claude-opus-5-5",
            provider="anthropic",
            tool_call=ToolCall("lookup_order", arguments),
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
    return code, " ".join(out.getvalue().split())


@pytest.mark.usefixtures("no_keys")
def test_no_key_prints_the_plan_and_exits_zero(tmp_path: Path) -> None:
    code, text = run([], tmp_path, never_called)
    assert code == 0
    assert "Part 1. The contract the caller reads." in text
    assert '"additionalProperties": false' in text
    assert "13 calls. 3 accepted, 10 rejected. 13 of 13 match" in text
    assert "6 calls." in text
    assert "claude-opus-5-5 at $4.00 input and $20.00 output" in text
    assert "gpt-5.6-sol at $4.00 input and $20.00 output" in text
    assert "list price checked on 2026-10-09" in text
    assert "list price as of 2026-09-15" in text
    assert "Order of magnitude: a few cents" in text
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
    assert "Cost estimate: 6 calls." in text
    assert "Dry run: stopping before any paid call." in text
    assert "uv run python first_call.py" in text
    assert not list(tmp_path.iterdir())


@pytest.mark.usefixtures("anthropic_key")
def test_an_unpriced_model_says_there_is_no_estimate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LAB_ANTHROPIC_MODEL", "claude-unlisted")
    _, text = run(["--dry-run"], tmp_path, never_called)
    assert "no list price for claude-unlisted" in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_full_run_validates_before_executing(tmp_path: Path) -> None:
    fake = Scripted()
    code, text = run([], tmp_path, fake)
    assert code == 0
    assert len(fake.requests) == 6
    assert all(
        r.tool is not None and r.tool.name == "lookup_order" for r in fake.requests
    )
    assert "Pellwick Dental Group" in fake.requests[0].system
    records = runlog.read(tmp_path / RUN_FILE)
    assert [r.verdict for r in records] == ["accepted"] * 2 + ["rejected"] * 4
    assert [r.error_kinds for r in records[2:]] == [
        ("not_yours",),
        ("not_yours",),
        ("bad_format",),
        ("not_found",),
    ]
    assert records[0].result is not None
    assert records[0].result["total"] == "$960.00"
    assert records[2].result == {
        "status": "rejected",
        "is_error": True,
        "errors": [
            {
                "field": "order_id",
                "message": "No order ORD-20877 on this customer's account.",
            }
        ],
    }
    assert "Accepted 2. Rejected 4. No tool call 0." in text
    assert "6 of 6 verdicts match" in text
    assert "Served model: claude-opus-5-5 (anthropic)." in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_smuggled_customer_id_is_rejected_by_the_schema(tmp_path: Path) -> None:
    smuggled = {
        "order_id": "ORD-20877",
        "response_format": "summary",
        "customer_id": "cus_tallgrass",
    }
    fake = Scripted(arguments={REQUESTS[2].message: smuggled})
    run([], tmp_path, fake)
    record = runlog.answered(runlog.read(tmp_path / RUN_FILE))["r3"]
    assert record.error_kinds == ("unknown_field",)
    assert record.result is not None
    assert "Tallgrass" not in str(record.result)


@pytest.mark.usefixtures("anthropic_key")
def test_limit_caps_the_calls(tmp_path: Path) -> None:
    fake = Scripted()
    code, text = run(["--limit", "2"], tmp_path, fake)
    assert code == 0
    assert len(fake.requests) == 2
    assert "Cost estimate: 2 calls." in text
    assert "4 requests still without a verdict" in text
    assert "r6 signed in as Orrin and Shaw Architects not run yet" in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_prose_answer_is_recorded_and_the_loop_moves_on(tmp_path: Path) -> None:
    prose = TaskFailure(
        "no_tool_call",
        "The model answered in text instead of calling the tool.",
        retryable=True,
    )
    fake = Scripted(fail_on={3: prose})
    code, text = run([], tmp_path, fake)
    assert code == 0
    assert len(fake.requests) == 6
    assert "Model call failed (no_tool_call)" in text
    assert "The loop moves on." in text
    assert "Accepted 2. Rejected 3. No tool call 1." in text
    assert "1 request still without a verdict" in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_result_without_a_tool_call_counts_as_prose(tmp_path: Path) -> None:
    def no_call(request: TaskRequest) -> TaskResult | TaskFailure:
        return TaskResult("Paid.", 1, 1, 1, "claude-opus-5-5", "anthropic")

    code, text = run(["--limit", "1"], tmp_path, no_call)
    assert code == 0
    assert "no verdict: no_tool_call." in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_provider_failure_stops_and_suggests_resume(tmp_path: Path) -> None:
    failure = TaskFailure("rate_limit", "Too many requests.", retryable=True)
    fake = Scripted(fail_on={3: failure})
    code, text = run([], tmp_path, fake)
    assert code == 1
    assert len(fake.requests) == 3
    assert "Model call failed (rate_limit): Too many requests." in text
    assert "again with --resume to continue from r3" in text
    records = runlog.read(tmp_path / RUN_FILE)
    assert [r.status for r in records] == ["answered", "answered", "failed"]


@pytest.mark.usefixtures("anthropic_key")
def test_resume_skips_requests_with_a_verdict(tmp_path: Path) -> None:
    failure = TaskFailure("server", "Overloaded.", retryable=True)
    run([], tmp_path, Scripted(fail_on={3: failure}))
    second = Scripted()
    code, text = run(["--resume"], tmp_path, second)
    assert code == 0
    assert len(second.requests) == 4
    assert second.requests[0].user == REQUESTS[2].message
    assert "2 of 6 requests already have a verdict" in text
    assert "Accepted 2. Rejected 4." in text
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
    assert code == 1
    assert "Not retryable" in text
    assert "Fix the cause, then run again." in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_bad_data_file_refuses_to_start(tmp_path: Path) -> None:
    bad = tmp_path / "orders.json"
    bad.write_text('{"customers": [], "orders": []}', encoding="utf-8")
    out = io.StringIO()
    code = main([], complete_fn=never_called, orders_path=bad, out=out)
    assert code == 1
    assert out.getvalue().startswith("Cannot start:")


def test_limit_must_be_positive(tmp_path: Path) -> None:
    with pytest.raises(SystemExit):
        run(["--limit", "0"], tmp_path, never_called)
