"""Turn a run file into numbers, a printed report, and a selection note.

Usage: uv run python report.py runs/<file>.jsonl

It reprints the report for any earlier run and refreshes that run's
selection note next to it. A note whose Decision section you have written
is kept as it is. It makes no model call.
"""

import statistics
import sys
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, TextIO

import baseline
import metrics
import prices
import runlog
from cases import DEFAULT_CASES, CaseError, CaseSet, load
from task import Rejected, check

Answer = str | Rejected
NoteStatus = Literal["written", "kept"]

DECISION_HEADING = "## Decision"
DECISION_PLACEHOLDER = (
    "Write yours here: what you would ship, the number that would make you "
    "revisit it, and what you would measure next."
)


@dataclass(frozen=True)
class Scores:
    """One classifier on a set of cases."""

    name: str
    cases: int
    correct: int
    rejected: int
    matrix: metrics.Matrix
    stats: list[metrics.LabelStats]

    @property
    def accuracy(self) -> float | None:
        """Correct over cases, or None with no cases."""
        return metrics.share(self.correct, self.cases)


@dataclass(frozen=True)
class AmbiguousRow:
    """An ambiguous case, what each side said, and whether it passed."""

    id: str
    accept: tuple[str, ...]
    baseline: str
    model: str
    model_passed: bool | None


@dataclass(frozen=True)
class Summary:
    """Everything the report and the selection note print."""

    total_cases: int
    compared_cases: int
    baseline: Scores
    model: Scores | None
    ambiguous: list[AmbiguousRow]
    input_tokens: int
    output_tokens: int
    total_latency_ms: int
    median_latency_ms: float | None
    served_models: tuple[str, ...]
    provider: str
    failed_calls: int
    price: prices.Price | None
    cost_usd: float | None


def score(name: str, case_set: CaseSet, answers: Mapping[str, Answer]) -> Scores:
    """Accuracy over the answered cases, and the matrix on single-label ones."""
    answered = [case for case in case_set.cases if case.id in answers]
    correct = sum(1 for case in answered if check(case, answers[case.id]))
    rejected = sum(1 for case in answered if isinstance(answers[case.id], Rejected))
    pairs = [
        (case.expected, _label(answers[case.id]))
        for case in answered
        if case.expected is not None
    ]
    matrix = metrics.confusion(pairs, case_set.categories)
    return Scores(
        name=name,
        cases=len(answered),
        correct=correct,
        rejected=rejected,
        matrix=matrix,
        stats=metrics.per_label(matrix, case_set.categories),
    )


def model_answers(records: list[runlog.Record]) -> dict[str, Answer]:
    """The validated answer per case from the latest answered record."""
    answers: dict[str, Answer] = {}
    for case_id, record in runlog.answered(records).items():
        if record.label is None:
            answers[case_id] = Rejected(raw=record.raw, reason=record.rejected_reason)
        else:
            answers[case_id] = record.label
    return answers


def summarize(
    case_set: CaseSet,
    records: list[runlog.Record],
    classify: Callable[[str], str] = baseline.classify,
) -> Summary:
    """Score the baseline and the model on the same cases, plus usage and cost."""
    model = model_answers(records)
    rules: dict[str, Answer] = {
        case.id: classify(case.input) for case in case_set.cases
    }
    if model:
        rules = {case_id: rules[case_id] for case_id in rules if case_id in model}
    latest = list(runlog.answered(records).values())
    latencies = [record.latency_ms for record in latest]
    input_tokens = sum(record.input_tokens for record in latest)
    output_tokens = sum(record.output_tokens for record in latest)
    served = tuple(sorted({record.model for record in latest if record.model}))
    price = prices.lookup(served[0]) if len(served) == 1 else None
    cost = prices.cost_usd(price, input_tokens, output_tokens) if price else None
    return Summary(
        total_cases=len(case_set.cases),
        compared_cases=len(rules),
        baseline=score("Rules baseline", case_set, rules),
        model=score("Model", case_set, model) if model else None,
        ambiguous=[
            AmbiguousRow(
                id=case.id,
                accept=case.accept,
                baseline=_label(rules[case.id]) if case.id in rules else "-",
                model=_label(model[case.id]) if case.id in model else "-",
                model_passed=check(case, model[case.id]) if case.id in model else None,
            )
            for case in case_set.cases
            if case.ambiguous and case.id in rules
        ],
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_latency_ms=sum(latencies),
        median_latency_ms=statistics.median(latencies) if latencies else None,
        served_models=served,
        provider=next((record.provider for record in latest), ""),
        failed_calls=sum(1 for record in records if record.status == "failed"),
        price=price,
        cost_usd=cost,
    )


def format_scores(scores: Scores, categories: Sequence[str]) -> str:
    """Accuracy, the confusion matrix, and the per-label table for one side."""
    single = sum(sum(row.values()) for row in scores.matrix.values())
    lines = [
        f"{scores.name}: {scores.correct} of {scores.cases} correct "
        f"({metrics.percent(scores.accuracy)}). "
        f"Rejected by the output contract: {scores.rejected}.",
        "",
        f"Confusion matrix on the {single} single-label cases.",
        metrics.format_matrix(scores.matrix, categories),
        "",
        "Precision: of the cases given a label, the share that had it.",
        "Recall: of the cases that had a label, the share given it.",
        metrics.format_stats(scores.stats),
    ]
    return "\n".join(lines)


def format_report(summary: Summary, categories: Sequence[str]) -> str:
    """The whole printed report."""
    if summary.model is None:
        return "No model answers yet.\n\n" + format_scores(summary.baseline, categories)
    model = summary.model
    lines = [
        "Report",
        f"Compared on {summary.compared_cases} of {summary.total_cases} cases.",
        f"Rules baseline: {summary.baseline.correct} correct "
        f"({metrics.percent(summary.baseline.accuracy)}).",
        f"Model: {model.correct} correct ({metrics.percent(model.accuracy)}).",
        "",
        format_scores(summary.baseline, categories),
        "",
        format_scores(model, categories),
        "",
        "Ambiguous cases, scored against their accepted labels:",
    ]
    for row in summary.ambiguous:
        verdict = {True: "pass", False: "fail", None: "-"}[row.model_passed]
        lines.append(
            f"  {row.id}  accepts {' or '.join(row.accept)}. "
            f"Rules said {row.baseline}. Model said {row.model} ({verdict})."
        )
    lines += ["", *usage_lines(summary)]
    return "\n".join(lines)


def usage_lines(summary: Summary) -> list[str]:
    """Tokens, latency, cost, and the served model id."""
    median = summary.median_latency_ms
    latency = f"Latency: {summary.total_latency_ms / 1000:.1f} s in total."
    if median is not None:
        latency = latency[:-1] + f", median {median / 1000:.2f} s per call."
    lines = [
        f"Tokens: {summary.input_tokens:,} input, {summary.output_tokens:,} output.",
        latency,
        f"Served model: {', '.join(summary.served_models) or 'unknown'} "
        f"({summary.provider or 'unknown provider'}).",
    ]
    if summary.price is not None and summary.cost_usd is not None:
        lines.append(
            f"Cost from actual tokens: {prices.format_dollars(summary.cost_usd)} at "
            f"{prices.format_price(summary.price)}."
        )
    else:
        lines.append(
            "Cost: no list price in prices.py for this model, so no dollar figure."
        )
    if summary.failed_calls:
        lines.append(
            f"Failed calls recorded in this run file: {summary.failed_calls}. "
            "A later answer for the same case replaces them."
        )
    return lines


def selection_note(summary: Summary, case_set: CaseSet, run_name: str) -> str:
    """A Markdown selection note with the measured numbers filled in."""
    if summary.model is None:
        return ""
    model = summary.model
    served = ", ".join(summary.served_models) or "unknown"
    coverage = (
        f"{summary.compared_cases} synthetic tickets, all answered."
        if summary.compared_cases == summary.total_cases
        else f"{summary.compared_cases} of {summary.total_cases} synthetic "
        "tickets answered. This is a partial run."
    )
    weakest = min(
        (item for item in model.stats if item.recall is not None),
        key=lambda item: item.recall or 0.0,
        default=None,
    )
    lines = [
        "# Selection note: ticket triage",
        "",
        f"Run file: {run_name}. Written by report.py from measured results.",
        "Edit the Decision section by hand.",
        "",
        "## The task",
        "",
        f"{case_set.task} The label set is fixed: "
        f"{', '.join(case_set.categories)}. An answer counts as correct when it "
        "matches the case's expected label, or one of the accepted labels on an "
        "ambiguous case. The output contract rejects any answer outside the label "
        "set, and a rejected answer counts as wrong.",
        "",
        "## What was measured",
        "",
        f"- Cases: {coverage}",
        f"- Rules baseline: {summary.baseline.correct} of {summary.baseline.cases} "
        f"correct ({metrics.percent(summary.baseline.accuracy)}).",
        f"- Model {served} ({summary.provider}): {model.correct} of {model.cases} "
        f"correct ({metrics.percent(model.accuracy)}). "
        f"Answers rejected by the contract: {model.rejected}.",
    ]
    if weakest is not None:
        lines.append(
            f"- The model's lowest recall: {weakest.label}, "
            f"{metrics.percent(weakest.recall)} "
            f"({weakest.correct} of {weakest.support})."
        )
    lines.append(
        f"- Tokens: {summary.input_tokens:,} input, {summary.output_tokens:,} output."
    )
    if summary.price is not None and summary.cost_usd is not None:
        per_thousand = summary.cost_usd / model.cases * 1000 if model.cases else 0.0
        lines.append(
            f"- Cost: {prices.format_dollars(summary.cost_usd)} for this run, about "
            f"{prices.format_dollars(per_thousand)} per 1,000 tickets, at "
            f"{prices.format_price(summary.price)}."
        )
    if summary.median_latency_ms is not None:
        lines.append(
            f"- Latency: median {summary.median_latency_ms / 1000:.2f} s per call."
        )
    lines += [
        "",
        "## Reading",
        "",
        reading(summary.baseline, model),
        "",
        "## What this note does not show",
        "",
        "- One run. A second run can differ by a case or two. Run it again "
        "before you trust a gap that small.",
        f"- {summary.total_cases} synthetic cases, written with the labels in "
        "mind. Real tickets are messier and longer.",
        "- The rules were written while looking at these cases, which flatters them.",
        f"- The served model id is {served}. Record whether you pinned it or "
        "called an alias that can move.",
        "",
        DECISION_HEADING,
        "",
        DECISION_PLACEHOLDER,
        "",
    ]
    return "\n".join(lines)


def reading(rules: Scores, model: Scores) -> str:
    """One plain-language reading of the gap. A starting point, not a verdict."""
    if rules.accuracy is None or model.accuracy is None:
        return "Nothing to compare yet."
    gap = model.correct - rules.correct
    points = round((model.accuracy - rules.accuracy) * 100)
    if gap >= 2 and points >= 10:
        return (
            f"The model is ahead of the rules by {gap} cases ({points} points) on "
            "the same tickets. On this evidence it earns its place, at the cost "
            "and latency above."
        )
    if gap > 0:
        return (
            f"The model is ahead by {gap} case{'s' if gap > 1 else ''}. On "
            f"{model.cases} cases and one run that gap is too small to settle the "
            "question. Grow the case set before you choose."
        )
    return (
        "The model does not beat the rules on these cases. Keep the rules, or "
        "change the task or the prompt and measure again."
    )


def note_path(run_path: Path) -> Path:
    """Where a run's selection note lives: next to the run file."""
    return run_path.with_name(f"{run_path.stem}-selection.md")


def write_note(
    summary: Summary, case_set: CaseSet, run_path: Path
) -> tuple[Path, NoteStatus] | None:
    """Write or refresh the selection note. None when there is nothing to note.

    A note whose Decision section no longer holds the placeholder has your
    decision in it. It is kept as it is, and the status says "kept".
    """
    text = selection_note(summary, case_set, run_path.name)
    if not text:
        return None
    path = note_path(run_path)
    if path.exists() and decision_written(path.read_text(encoding="utf-8")):
        return path, "kept"
    path.write_text(text, encoding="utf-8")
    return path, "written"


def decision_written(note: str) -> bool:
    """True when the Decision section holds anything but the placeholder."""
    _, found, decision = note.partition(DECISION_HEADING)
    if not found:
        return True
    return decision.strip() != DECISION_PLACEHOLDER


def note_message(path: Path, status: NoteStatus) -> str:
    """The line printed after a note is written or kept."""
    if status == "kept":
        return (
            f"Selection note kept: {path.name}. Its Decision section has your "
            "words in it. Delete the file to regenerate it with these numbers."
        )
    return (
        f"Selection note written to {path.name}. Read it, then write your "
        "decision at the end."
    )


def main(
    argv: Sequence[str] | None = None,
    out: TextIO | None = None,
    cases_path: Path = DEFAULT_CASES,
) -> int:
    """Reprint a run's report and refresh its selection note."""
    stream = out if out is not None else sys.stdout
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 1:
        print("Usage: uv run python report.py runs/<file>.jsonl", file=stream)
        return 2
    run_path = Path(args[0])
    try:
        case_set = load(cases_path)
        records = runlog.read(run_path)
    except (CaseError, runlog.RunLogError) as exc:
        print(f"Cannot report: {exc}", file=stream)
        return 1
    except OSError as exc:
        print(f"Cannot read {run_path}: {exc.strerror}.", file=stream)
        return 1
    summary = summarize(case_set, records)
    print(format_report(summary, case_set.categories), file=stream)
    note = write_note(summary, case_set, run_path)
    if note is not None:
        print(f"\n{note_message(*note)}", file=stream)
    return 0


def _label(answer: Answer) -> str:
    return metrics.REJECTED if isinstance(answer, Rejected) else answer


if __name__ == "__main__":
    raise SystemExit(main())
