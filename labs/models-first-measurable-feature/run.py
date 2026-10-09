"""The lab: rules baseline, cost statement, model run, report, selection note.

uv run python run.py --dry-run     baseline and cost statement, no call
uv run python run.py               the full run, one call per case
uv run python run.py --limit 5     at most five calls this time
uv run python run.py --resume      continue the newest run for this model

With no API key it prints what it would do and exits 0. Provider code lives
in adapter.py. This file only calls adapter.complete.
"""

import argparse
import os
import sys
import textwrap
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import TextIO

import adapter
import baseline
import prices
import report
import runlog
from adapter import Provider, TaskFailure, TaskRequest, TaskResult
from cases import DEFAULT_CASES, Case, CaseError, CaseSet, load
from task import build_prompt, check, validate

RUNS_DIR = Path(__file__).parent / "runs"
WRAP = 79
FIRST_CALL_COMMAND = "uv run python first_call.py"

CompleteFn = Callable[[TaskRequest], TaskResult | TaskFailure]
Clock = Callable[[], datetime]


def utc_now() -> datetime:
    """The current time in UTC."""
    return datetime.now(UTC)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """The three flags the lab honors."""
    parser = argparse.ArgumentParser(
        description="Ticket triage: a rules baseline against one model."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the baseline, the plan and the cost estimate, then stop",
    )
    parser.add_argument(
        "--limit",
        type=_positive,
        default=None,
        metavar="N",
        help="make at most N model calls in this run",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="continue the newest run file for this provider and model",
    )
    return parser.parse_args(list(argv))


def model_for(provider: Provider, env: Mapping[str, str]) -> str:
    """The model id the adapter will call, from the same variables it reads."""
    if provider == "anthropic":
        return env.get("LAB_ANTHROPIC_MODEL") or adapter.DEFAULT_ANTHROPIC_MODEL
    return env.get("LAB_OPENAI_MODEL") or adapter.DEFAULT_OPENAI_MODEL


def cost_statement(model: str, calls: int, input_tokens: int) -> str:
    """The plain-language cost estimate printed before any paid call."""
    output_tokens = calls * prices.ESTIMATED_OUTPUT_TOKENS
    per_call = round(input_tokens / calls) if calls else 0
    head = (
        f"{calls} call{'s' if calls != 1 else ''}. About {input_tokens:,} input "
        f"tokens in total (roughly {per_call} per call) and {output_tokens:,} "
        f"output tokens ({prices.ESTIMATED_OUTPUT_TOKENS} per call, which "
        "includes the model's reasoning tokens)."
    )
    price = prices.lookup(model)
    if price is None:
        return (
            f"{head} prices.py has no list price for {model}, so there is no "
            "dollar estimate. Add a row to prices.py, or check the provider's "
            "pricing page, before you run it."
        )
    dollars = prices.cost_usd(price, input_tokens, output_tokens)
    longer = prices.cost_usd(price, input_tokens, output_tokens * 5)
    return (
        f"{head} On {model} at {prices.format_price(price)}, that is about "
        f"{prices.format_dollars(dollars)}. Order of magnitude: "
        f"{prices.order_of_magnitude(dollars)}. If every answer ran five times "
        f"longer it would be about {prices.format_dollars(longer)}, "
        f"{_still(dollars, longer)}."
    )


def _still(dollars: float, longer: float) -> str:
    size = prices.order_of_magnitude(longer)
    if size == prices.order_of_magnitude(dollars):
        return f"still {size}"
    return size


def main(
    argv: Sequence[str] | None = None,
    *,
    env: Mapping[str, str] | None = None,
    complete_fn: CompleteFn = adapter.complete,
    runs_dir: Path = RUNS_DIR,
    cases_path: Path = DEFAULT_CASES,
    out: TextIO | None = None,
    clock: Clock = utc_now,
) -> int:
    """Run the lab. Returns the process exit code."""
    stream = out if out is not None else sys.stdout
    environ = os.environ if env is None else env
    args = parse_args(sys.argv[1:] if argv is None else argv)

    def say(text: str = "") -> None:
        print(text, file=stream)

    def para(text: str) -> None:
        say(
            textwrap.fill(
                text,
                width=WRAP,
                subsequent_indent=" " * _indent(text),
                break_on_hyphens=False,
            )
        )

    try:
        case_set = load(cases_path)
    except CaseError as exc:
        say(f"Cannot start: {exc}")
        return 1

    say("Ticket triage: the first measurable feature")
    say("=" * 44)
    para(
        f"{case_set.task} {len(case_set.cases)} synthetic cases. Labels: "
        f"{', '.join(case_set.categories)}."
    )
    say()
    say("Part 1. The rules baseline. No model, no cost.")
    rules = {case.id: baseline.classify(case.input) for case in case_set.cases}
    say(
        report.format_scores(
            report.score("Rules baseline", case_set, rules), case_set.categories
        )
    )
    say()

    provider = adapter.pick_provider(environ)
    system = build_prompt(case_set.categories)
    run_path, done = _run_file(provider, environ, args.resume, runs_dir, clock, para)
    todo = [case for case in case_set.cases if case.id not in done]
    if args.limit is not None:
        todo = todo[: args.limit]

    say("Part 2. The plan, before any paid call.")
    para(
        "The model step sends each ticket to the model through adapter.complete, "
        "one call per case, one at a time, at low effort. Each answer goes "
        "through the output contract: one label from the set, or rejected. "
        "Then the same report runs on the baseline and the model."
    )
    if done:
        para(
            f"{len(done)} of {len(case_set.cases)} cases already have an answer "
            f"in {run_path.name}. They are skipped."
        )
    input_tokens = sum(prices.estimate_input_tokens(system + c.input) for c in todo)
    say()
    if provider is None:
        para("Cost estimate, for each default model:")
        for name in (adapter.DEFAULT_ANTHROPIC_MODEL, adapter.DEFAULT_OPENAI_MODEL):
            para(f"- {cost_statement(name, len(todo), input_tokens)}")
        say()
        para(
            "No ANTHROPIC_API_KEY or OPENAI_API_KEY is set, so the lab stops "
            "here and makes no call. Set one of them, then start with the raw "
            "call, one call before the adapter:"
        )
        say(f"  {FIRST_CALL_COMMAND}")
        para("Then run this again. The tests need no key. Run them with:")
        say("  uv run pytest -q")
        return 0

    model = model_for(provider, environ)
    para(f"Provider: {provider}. Model: {model}.")
    para(f"Cost estimate: {cost_statement(model, len(todo), input_tokens)}")
    say()
    if args.dry_run:
        para("Dry run: stopping before any paid call.")
        para(
            "If you have not made the raw call yet, start there. It is one "
            "call, before the adapter:"
        )
        say(f"  {FIRST_CALL_COMMAND}")
        return 0

    say(f"Part 3. The model run. Writing {run_path.name}.")
    for case in todo:
        outcome = _call(case, case_set, system, complete_fn, clock)
        record = (
            runlog.from_failure(case.id, outcome, model, provider, _stamp_iso(clock))
            if isinstance(outcome, TaskFailure)
            else outcome
        )
        runlog.append(run_path, record)
        if isinstance(outcome, TaskFailure):
            say(f"  {case.id}  failed")
            para(adapter.explain(outcome))
            if outcome.retryable:
                para(
                    f"Run the same command again with --resume to continue from "
                    f"{case.id}. Answers so far are saved in {run_path.name}."
                )
            else:
                para(
                    "Fix the cause, then run again. Add --resume to keep the "
                    f"answers saved in {run_path.name}."
                )
            return 1
        say(_progress(outcome))

    records = runlog.read(run_path) if run_path.exists() else []
    remaining = len(case_set.cases) - len(runlog.answered(records))
    if remaining:
        say()
        para(
            f"{remaining} case{'s' if remaining != 1 else ''} still without an "
            "answer. Run again with --resume to continue."
        )
    say()
    say("Part 4. The report.")
    summary = report.summarize(case_set, records)
    say(report.format_report(summary, case_set.categories))
    note = report.write_note(summary, case_set, run_path) if records else None
    if note is not None:
        say()
        para(f"Part 5. {report.note_message(*note)}")
    return 0


def _call(
    case: Case,
    case_set: CaseSet,
    system: str,
    complete_fn: CompleteFn,
    clock: Clock,
) -> runlog.Record | TaskFailure:
    result = complete_fn(TaskRequest(system=system, user=case.input))
    if isinstance(result, TaskFailure):
        return result
    answer = validate(result.text, case_set.categories)
    return runlog.from_result(
        case.id, result, answer, check(case, answer), _stamp_iso(clock)
    )


def _progress(record: runlog.Record) -> str:
    verdict = "pass" if record.passed else "FAIL"
    said = record.label if record.label is not None else "rejected"
    line = f"  {record.id}  {said:<16} {verdict}  {record.latency_ms / 1000:.2f} s"
    if record.label is None:
        line += f"  ({record.rejected_reason})"
    return line


def _run_file(
    provider: Provider | None,
    env: Mapping[str, str],
    resume: bool,
    runs_dir: Path,
    clock: Clock,
    para: Callable[[str], None],
) -> tuple[Path, set[str]]:
    """The run file to write, and the case ids it already answered."""
    name = provider or "none"
    model = model_for(provider, env) if provider is not None else "none"
    if resume and provider is not None:
        found = runlog.newest(runs_dir, name, model)
        if found is None:
            para(f"No earlier run for {name} {model} in runs/. Starting a new run.")
        else:
            try:
                return found, set(runlog.answered(runlog.read(found)))
            except runlog.RunLogError as exc:
                para(f"Cannot resume from {found.name}: {exc} Starting a new run.")
    stamp = clock().strftime("%Y%m%dT%H%M%SZ")
    return runs_dir / runlog.run_file_name(stamp, name, model), set()


def _indent(text: str) -> int:
    return 2 if text.startswith("- ") else 0


def _stamp_iso(clock: Clock) -> str:
    return clock().isoformat(timespec="seconds")


def _positive(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return number


if __name__ == "__main__":
    raise SystemExit(main())
