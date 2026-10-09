"""The two reports: the fixture calls against the validator, and the live run.

Both say which calls were accepted, which were rejected, and why.
"""

import json
import statistics
import textwrap
from collections import Counter
from dataclasses import dataclass

import prices
from contract import STAGES, Accepted, Rejected, Session, validate
from executor import error_result, execute
from runlog import Record
from scenarios import FixtureCall, Request
from store import OrderStore

WRAP = 79


@dataclass(frozen=True)
class FixtureOutcome:
    """What the validator decided for one hand-written call, and the result."""

    call: FixtureCall
    verdict: Accepted | Rejected
    result: dict[str, object]

    @property
    def outcome(self) -> str:
        """'accepted', or the first error kind."""
        if isinstance(self.verdict, Accepted):
            return "accepted"
        return self.verdict.kinds[0]

    @property
    def as_expected(self) -> bool:
        """Whether the validator reached the verdict the fixture names."""
        if isinstance(self.verdict, Accepted):
            return self.call.expect == "accepted"
        return self.call.expect in self.verdict.kinds


def check_fixture_calls(
    calls: list[FixtureCall], store: OrderStore
) -> list[FixtureOutcome]:
    """Validate every fixture call, then execute the accepted ones. No model."""
    outcomes = []
    for call in calls:
        verdict = validate(call.name, call.arguments, Session(call.customer_id), store)
        result = (
            execute(verdict, store)
            if isinstance(verdict, Accepted)
            else error_result(verdict)
        )
        outcomes.append(FixtureOutcome(call, verdict, result))
    return outcomes


def format_fixture_table(outcomes: list[FixtureOutcome]) -> str:
    """One block per call: the call, the verdict, and the reason."""
    lines: list[str] = []
    for item in outcomes:
        call = item.call
        lines.extend(_wrap(f"{call.id}  {call.why}", 2, 7))
        lines.extend(
            _wrap(
                f"session {call.customer_id}, call "
                f"{render_call(call.name, call.arguments)}",
                7,
                9,
            )
        )
        if isinstance(item.verdict, Accepted):
            lines.extend(_wrap(f"accepted. {_found(item.result)}", 7, 9))
        else:
            for error in item.verdict.errors:
                lines.extend(
                    _wrap(
                        f"rejected, {error.stage}: {error.kind}. {error.message}", 7, 9
                    )
                )
        if not item.as_expected:
            lines.append(f"       UNEXPECTED: the fixture expects {call.expect}.")
    matched = sum(item.as_expected for item in outcomes)
    accepted = sum(isinstance(item.verdict, Accepted) for item in outcomes)
    lines.append("")
    lines.extend(
        _wrap(
            f"{len(outcomes)} calls. {accepted} accepted, "
            f"{len(outcomes) - accepted} rejected. {matched} of {len(outcomes)} "
            "match the verdict the fixture expects.",
            2,
            2,
        )
    )
    return "\n".join(lines)


def _wrap(text: str, first: int, rest: int) -> list[str]:
    return textwrap.wrap(
        text,
        width=WRAP,
        initial_indent=" " * first,
        subsequent_indent=" " * rest,
        break_on_hyphens=False,
        break_long_words=False,
    )


def render_call(name: str, arguments: object) -> str:
    """'lookup_order({"order_id": "ORD-10421", ...})', short and exact."""
    return f"{name}({json.dumps(arguments, ensure_ascii=False)})"


@dataclass(frozen=True)
class Row:
    """One request and what happened to it."""

    request: Request
    record: Record | None

    @property
    def outcome(self) -> str:
        """accepted, an error kind, no_tool_call, another failure, or not_run."""
        if self.record is None:
            return "not_run"
        if self.record.status == "failed":
            return self.record.failure_kind
        if self.record.verdict == "accepted":
            return "accepted"
        return self.record.error_kinds[0] if self.record.error_kinds else "rejected"

    @property
    def as_expected(self) -> bool | None:
        """None when the validator never saw a call for this request."""
        if self.record is None or self.record.status == "failed":
            return None
        if self.record.verdict == "accepted":
            return self.request.expect == "accepted"
        return self.request.expect in self.record.error_kinds


@dataclass(frozen=True)
class Summary:
    """The live run, counted."""

    rows: tuple[Row, ...]
    accepted: int
    rejected: int
    no_call: int
    not_run: int
    by_stage: dict[str, int]
    input_tokens: int
    output_tokens: int
    latencies_ms: tuple[int, ...]
    models: tuple[tuple[str, str], ...]


def summarize(requests: list[Request], records: list[Record]) -> Summary:
    """Count the latest record for every request."""
    latest: dict[str, Record] = {}
    for record in records:
        latest[record.id] = record
    rows = tuple(Row(request, latest.get(request.id)) for request in requests)
    stages: Counter[str] = Counter()
    for row in rows:
        if row.record is not None and row.record.verdict == "rejected":
            kind = row.record.error_kinds[0] if row.record.error_kinds else ""
            stages[STAGES.get(kind, "schema")] += 1
    called = [r for r in records if r.status == "answered"]
    return Summary(
        rows=rows,
        accepted=sum(row.outcome == "accepted" for row in rows),
        rejected=sum(
            row.record is not None and row.record.verdict == "rejected" for row in rows
        ),
        no_call=sum(
            row.record is not None and row.record.status == "failed" for row in rows
        ),
        not_run=sum(row.record is None for row in rows),
        by_stage={stage: stages[stage] for stage in ("schema", "rule", "scope")},
        input_tokens=sum(r.input_tokens for r in records),
        output_tokens=sum(r.output_tokens for r in records),
        latencies_ms=tuple(r.latency_ms for r in called),
        models=tuple(sorted({(r.model, r.provider) for r in called})),
    )


def format_report(summary: Summary, store: OrderStore) -> str:
    """The live report: every request, its call, the verdict and the reason."""
    total = len(summary.rows)
    lines = [
        f"  {total - summary.not_run} of {total} requests were sent. "
        f"Accepted {summary.accepted}. Rejected {summary.rejected}. "
        f"No tool call {summary.no_call}.",
        "",
    ]
    for row in summary.rows:
        lines.extend(_row_lines(row, store))
    lines.append("")
    stages = summary.by_stage
    lines.append(
        f"  Rejections by check: schema {stages['schema']}, rule {stages['rule']}, "
        f"scope {stages['scope']}."
    )
    matched = [row.as_expected for row in summary.rows if row.as_expected is not None]
    if matched:
        lines.append(
            f"  {sum(matched)} of {len(matched)} verdicts match what the request "
            "file expects."
        )
    lines.extend(_usage_lines(summary))
    return "\n".join(lines)


def _row_lines(row: Row, store: OrderStore) -> list[str]:
    customer = store.customer(row.request.customer_id)
    name = customer.name if customer is not None else row.request.customer_id
    head = f"  {row.request.id}  signed in as {name}"
    record = row.record
    if record is None:
        return [head, "      not run yet"]
    if record.status == "failed":
        return [
            head,
            *_wrap(
                f"no verdict: {record.failure_kind}. {record.failure_message}", 6, 8
            ),
        ]
    lines = [head, *_wrap(render_call(record.tool_name, record.arguments), 6, 8)]
    expected = "as expected" if row.as_expected else f"expected {row.request.expect}"
    if record.verdict == "accepted":
        lines.extend(_wrap(f"accepted, {expected}. {_found(record.result)}", 6, 8))
    else:
        kind = record.error_kinds[0] if record.error_kinds else "rejected"
        stage = STAGES.get(kind, "schema")
        message = record.error_messages[0] if record.error_messages else ""
        lines.append(f"      rejected, {stage}: {kind}, {expected}.")
        lines.extend(_wrap(f"The caller is told: {message}", 6, 8))
    return lines


def _found(result: dict[str, object] | None) -> str:
    if not result or result.get("status") != "found":
        return "The executor found nothing."
    return (
        f"Result: {result.get('order_id')} for {result.get('customer')}, "
        f"{result.get('order_status')}, {result.get('total')}."
    )


def _usage_lines(summary: Summary) -> list[str]:
    if not summary.latencies_ms and not summary.input_tokens:
        return []
    texts = [
        f"Tokens: {summary.input_tokens:,} input, {summary.output_tokens:,} output, "
        "for the calls that came back with a tool call. A call that failed, "
        "including a prose answer, is not counted: the typed failure carries "
        "no usage."
    ]
    if summary.latencies_ms:
        total_s = sum(summary.latencies_ms) / 1000
        median_s = statistics.median(summary.latencies_ms) / 1000
        texts.append(f"Latency: {total_s:.1f} s in total, median {median_s:.2f} s.")
    for model, provider in summary.models:
        price = prices.lookup(model)
        if price is None:
            texts.append(
                f"Served model: {model} ({provider}). prices.py has no list "
                "price for it, so there is no dollar figure."
            )
            continue
        dollars = prices.cost_usd(price, summary.input_tokens, summary.output_tokens)
        texts.append(f"Served model: {model} ({provider}).")
        texts.append(
            f"Cost from actual tokens: about {prices.format_dollars(dollars)}, "
            f"at {prices.format_price(price)}."
        )
    return [line for text in texts for line in _wrap(text, 2, 4)]
