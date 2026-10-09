"""The fixture table and the live report, on in-memory records."""

import runlog
from adapter import TaskFailure, TaskResult, ToolCall
from contract import TOOL_NAME, Accepted, Session, validate
from executor import error_result, execute
from report import (
    check_fixture_calls,
    format_fixture_table,
    format_report,
    render_call,
    summarize,
)
from scenarios import Request, load_fixture_calls
from store import load_store

STORE = load_store()
AT = "2026-10-09T12:00:00+00:00"
REQUESTS = [
    Request("r1", "cus_pellwick", "Was ORD-10421 paid?", "accepted"),
    Request("r2", "cus_pellwick", "Check ORD-20877 for Tallgrass.", "not_yours"),
    Request("r3", "cus_orrin", "Check ORD-3102.", "bad_format"),
    Request("r4", "cus_orrin", "Where is my order?", "accepted"),
    Request("r5", "cus_orrin", "Status of ORD-99999?", "not_found"),
]


def answered(request: Request, order_id: str, latency_ms: int) -> runlog.Record:
    call = ToolCall(TOOL_NAME, {"order_id": order_id, "response_format": "summary"})
    verdict = validate(call.name, call.arguments, Session(request.customer_id), STORE)
    result = TaskResult("", 700, 100, latency_ms, "claude-opus-5", "anthropic", call)
    tool_result = (
        execute(verdict, STORE)
        if isinstance(verdict, Accepted)
        else error_result(verdict)
    )
    return runlog.from_verdict(
        request.id, request.customer_id, result, call, verdict, tool_result, AT
    )


def records() -> list[runlog.Record]:
    prose = TaskFailure("no_tool_call", "Answered in prose.", retryable=True)
    return [
        answered(REQUESTS[0], "ORD-10421", 1000),
        answered(REQUESTS[1], "ORD-20877", 2000),
        answered(REQUESTS[2], "ORD-3102", 4000),
        runlog.from_failure("r4", "cus_orrin", prose, "claude-opus-5", "anthropic", AT),
    ]


def test_summary_counts_each_outcome() -> None:
    summary = summarize(REQUESTS, records())
    assert (summary.accepted, summary.rejected, summary.no_call, summary.not_run) == (
        1,
        2,
        1,
        1,
    )
    assert summary.by_stage == {"schema": 0, "rule": 1, "scope": 1}
    assert [row.outcome for row in summary.rows] == [
        "accepted",
        "not_yours",
        "bad_format",
        "no_tool_call",
        "not_run",
    ]
    assert [row.as_expected for row in summary.rows] == [True, True, True, None, None]
    assert summary.input_tokens == 2100
    assert summary.latencies_ms == (1000, 2000, 4000)


def test_the_latest_record_per_request_wins() -> None:
    retry = answered(REQUESTS[3], "ORD-31002", 500)
    summary = summarize(REQUESTS, [*records(), retry])
    assert summary.rows[3].outcome == "accepted"
    assert summary.no_call == 0


def test_the_report_says_why_another_customers_order_was_rejected() -> None:
    text = format_report(summarize(REQUESTS, records()), STORE)
    flat = " ".join(text.split())
    assert "Accepted 1. Rejected 2. No tool call 1." in flat
    assert "rejected, scope: not_yours, as expected." in flat
    assert "The caller is told: No order ORD-20877 on this customer's account." in flat
    assert "Result: ORD-10421 for Pellwick Dental Group, paid, $960.00." in flat
    assert "no verdict: no_tool_call. Answered in prose." in flat
    assert "r5 signed in as Orrin and Shaw Architects not run yet" in flat
    assert "Rejections by check: schema 0, rule 1, scope 1." in flat
    assert "3 of 3 verdicts match" in flat


def test_the_report_prices_actual_tokens_with_the_date() -> None:
    flat = " ".join(format_report(summarize(REQUESTS, records()), STORE).split())
    assert "Tokens: 2,100 input, 300 output" in flat
    assert "Latency: 7.0 s in total, median 2.00 s." in flat
    assert "Served model: claude-opus-5 (anthropic)." in flat
    assert "about $0.02, at $5.00 input and $25.00 output" in flat
    assert "list price checked on 2026-10-09" in flat


def test_an_unexpected_verdict_is_flagged() -> None:
    wrong = Request("r1", "cus_pellwick", "m", "not_found")
    summary = summarize([wrong], [answered(wrong, "ORD-10421", 1)])
    flat = " ".join(format_report(summary, STORE).split())
    assert "accepted, expected not_found." in flat
    assert "0 of 1 verdicts match" in flat


def test_an_empty_run_prints_no_usage() -> None:
    flat = " ".join(format_report(summarize(REQUESTS, []), STORE).split())
    assert "0 of 5 requests were sent." in flat
    assert "Tokens" not in flat


def test_the_fixture_table_shows_verdicts_and_results() -> None:
    outcomes = check_fixture_calls(load_fixture_calls(STORE), STORE)
    text = format_fixture_table(outcomes)
    flat = " ".join(text.split())
    assert "rejected, scope: not_yours." in flat
    assert "accepted. Result: ORD-20877 for Tallgrass Cycling Club" in flat
    assert "13 of 13 match the verdict the fixture expects." in flat
    assert "UNEXPECTED" not in text
    assert all(len(line) <= 79 for line in text.splitlines())


def test_render_call_is_exact() -> None:
    assert (
        render_call("lookup_order", {"order_id": 1}) == 'lookup_order({"order_id": 1})'
    )
