"""The summary, the printed report, and the selection note."""

import io
import json
from pathlib import Path

import pytest

import runlog
from cases import Case, CaseSet
from metrics import REJECTED
from report import (
    DECISION_PLACEHOLDER,
    main,
    note_path,
    reading,
    score,
    selection_note,
    summarize,
    write_note,
)
from runlog import Record

AT = "2026-10-09T12:00:00+00:00"
CASES = CaseSet(
    task="Label a ticket.",
    categories=("billing", "bug", "other"),
    cases=(
        Case(id="a", input="charged twice", expected="billing"),
        Case(id="b", input="it crashes", expected="bug"),
        Case(id="c", input="hello", expected="other"),
        Case(
            id="d",
            input="card declined, crash",
            expected=None,
            accept=("billing", "bug"),
        ),
    ),
)


def answered(case_id: str, label: str | None, passed: bool) -> Record:
    return Record(
        id=case_id,
        status="answered",
        at=AT,
        raw=label or "dunno",
        label=label,
        rejected_reason="" if label else "'dunno' is not in the label set",
        passed=passed,
        input_tokens=1000,
        output_tokens=200,
        latency_ms=1000,
        model="claude-opus-5",
        provider="anthropic",
    )


def failed(case_id: str) -> Record:
    return Record(
        id=case_id,
        status="failed",
        at=AT,
        model="claude-opus-5",
        provider="anthropic",
        failure_kind="rate_limit",
        failure_message="slow down",
        retryable=True,
    )


RUN = [
    failed("a"),
    answered("a", "billing", passed=True),
    answered("b", "bug", passed=True),
    failed("c"),
    answered("c", None, passed=False),
    answered("d", "other", passed=False),
]


def rules(text: str) -> str:
    return "billing" if "charged" in text else "other"


def test_summary_with_two_failures_two_passes_and_one_rejection() -> None:
    summary = summarize(CASES, RUN, classify=rules)
    assert summary.model is not None
    assert (summary.model.correct, summary.model.cases) == (2, 4)
    assert summary.model.rejected == 1
    assert summary.model.matrix["other"][REJECTED] == 1
    assert (summary.baseline.correct, summary.baseline.cases) == (2, 4)
    assert summary.failed_calls == 2
    assert (summary.input_tokens, summary.output_tokens) == (4000, 800)
    assert summary.total_latency_ms == 4000
    assert summary.median_latency_ms == 1000
    assert summary.served_models == ("claude-opus-5",)
    # 4,000 input at $5 and 800 output at $25 per million tokens.
    assert summary.cost_usd == pytest.approx(0.02 + 0.02)
    assert summary.ambiguous[0].model == "other"
    assert summary.ambiguous[0].model_passed is False


def test_the_baseline_is_scored_on_the_same_cases_as_the_model() -> None:
    summary = summarize(CASES, [answered("a", "billing", passed=True)], rules)
    assert summary.compared_cases == 1
    assert summary.baseline.cases == 1


def test_with_no_answers_the_baseline_covers_every_case() -> None:
    summary = summarize(CASES, [failed("a")], rules)
    assert summary.model is None
    assert summary.baseline.cases == 4
    assert selection_note(summary, CASES, "run.jsonl") == ""


def test_an_unknown_model_has_no_dollar_figure() -> None:
    record = answered("a", "billing", passed=True)
    other = Record(**{**record.__dict__, "model": "someone-else-1"})
    summary = summarize(CASES, [other], rules)
    assert summary.price is None
    assert summary.cost_usd is None


def test_selection_note_carries_the_numbers() -> None:
    summary = summarize(CASES, RUN, classify=rules)
    note = selection_note(summary, CASES, "run.jsonl")
    assert note.startswith("# Selection note: ticket triage")
    assert "2 of 4 correct (50%)" in note
    assert "Answers rejected by the contract: 1." in note
    assert "list price checked on 2026-10-09" in note
    assert "## Decision" in note
    assert chr(0x2014) not in note
    assert "*" not in note


def test_an_untouched_note_is_refreshed(tmp_path: Path) -> None:
    run = tmp_path / "run.jsonl"
    first = summarize(CASES, RUN[:3], classify=rules)
    assert write_note(first, CASES, run) == (note_path(run), "written")
    assert "2 of 2 correct" in note_path(run).read_text(encoding="utf-8")
    second = summarize(CASES, RUN, classify=rules)
    assert write_note(second, CASES, run) == (note_path(run), "written")
    assert "2 of 4 correct" in note_path(run).read_text(encoding="utf-8")


def test_a_note_with_a_written_decision_survives(tmp_path: Path) -> None:
    run = tmp_path / "run.jsonl"
    summary = summarize(CASES, RUN, classify=rules)
    write_note(summary, CASES, run)
    path = note_path(run)
    edited = path.read_text(encoding="utf-8").replace(
        DECISION_PLACEHOLDER, "Ship the rules. Revisit below 90 percent."
    )
    path.write_text(edited, encoding="utf-8")
    assert write_note(summary, CASES, run) == (path, "kept")
    assert path.read_text(encoding="utf-8") == edited


def test_main_keeps_an_edited_note_and_says_so(tmp_path: Path) -> None:
    run = tmp_path / "20261009T120000Z-anthropic-claude-opus-5.jsonl"
    for record in RUN:
        runlog.append(run, record)
    note_path(run).write_text("# My note\n\n## Decision\n\nShip it.\n")
    out = io.StringIO()
    cases_path = write_cases(tmp_path / "cases.json")
    assert main([str(run)], out=out, cases_path=cases_path) == 0
    assert "Selection note kept" in out.getvalue()
    assert note_path(run).read_text() == "# My note\n\n## Decision\n\nShip it.\n"


def test_reading_depends_on_the_gap() -> None:
    rules_two = score("r", CASES, {"a": "billing", "b": "x", "c": "x", "d": "x"})
    model_four = score(
        "m", CASES, {"a": "billing", "b": "bug", "c": "other", "d": "bug"}
    )
    model_two = score("m", CASES, {"a": "billing", "b": "x", "c": "other", "d": "x"})
    assert "earns its place" in reading(rules_two, model_four)
    assert "too small" in reading(rules_two, model_two)
    assert "does not beat" in reading(model_four, rules_two)


def write_cases(path: Path) -> Path:
    data = {
        "task": CASES.task,
        "categories": list(CASES.categories),
        "cases": [
            {"id": case.id, "input": case.input, "expected": case.expected}
            if case.expected
            else {"id": case.id, "input": case.input, "accept": list(case.accept)}
            for case in CASES.cases
        ],
    }
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_main_prints_the_report_and_writes_the_note(tmp_path: Path) -> None:
    run = tmp_path / "20261009T120000Z-anthropic-claude-opus-5.jsonl"
    for record in RUN:
        runlog.append(run, record)
    out = io.StringIO()
    cases_path = write_cases(tmp_path / "cases.json")
    assert main([str(run)], out=out, cases_path=cases_path) == 0
    text = out.getvalue()
    assert "Served model: claude-opus-5 (anthropic)." in text
    assert note_path(run).exists()


def test_main_reports_a_missing_file(tmp_path: Path) -> None:
    out = io.StringIO()
    assert main([str(tmp_path / "missing.jsonl")], out=out) == 1
    assert "Cannot read" in out.getvalue()


def test_main_needs_one_argument() -> None:
    out = io.StringIO()
    assert main([], out=out) == 2
    assert "Usage" in out.getvalue()
