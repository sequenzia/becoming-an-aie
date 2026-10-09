"""The hand review: one output at a time, your verdict and an open note.

uv run python review.py            review the 30 outputs in data/
uv run python review.py --fresh    review the newest model run's outputs

Keys: p pass, f fail, s skip, q quit. After a verdict, write a short note.
On a fail, the note is required: name the first thing that went wrong, in
your own words. Do not reach for a fixed list of categories yet. That is
open coding, and the taxonomy comes after it.

Every label is written to the labels file the moment you give it, so
quitting loses nothing. Run the command again to continue where you
stopped. No model, no key, no cost.
"""

import argparse
import sys
import textwrap
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import fresh
import taxonomy
from records import (
    DEFAULT_LABELS,
    DEFAULT_OUTPUTS,
    DEFAULT_POLICY,
    DEFAULT_SCENARIOS,
    WORK_DIR,
    Label,
    Output,
    Policy,
    RecordError,
    Verdict,
    append_label,
    format_facts,
    latest,
    load_outputs,
    load_policy,
    load_scenarios,
    read_labels,
)

InputFn = Callable[[str], str]
OutputFn = Callable[[str], None]
Clock = Callable[[], datetime]

WRAP = 76
KEYS = {"p": "pass", "f": "fail", "s": "skip", "q": "quit"}


@dataclass(frozen=True)
class ReviewResult:
    """What one review session did."""

    labelled: int
    skipped: int
    remaining: int
    stopped_early: bool


def utc_now() -> datetime:
    """The current time in UTC."""
    return datetime.now(UTC)


def review(
    outputs: list[Output],
    policy: Policy,
    labels_path: Path,
    input_fn: InputFn,
    output_fn: OutputFn,
    *,
    categories: list[str] | None = None,
    clock: Clock = utc_now,
) -> ReviewResult:
    """Show each unlabelled output, ask for a verdict and a note, save at once.

    With categories set, a fail also asks which taxonomy category it belongs
    to. That is for fresh outputs, after your taxonomy exists.
    """
    done = set(latest(read_labels(labels_path)))
    todo = [output for output in outputs if output.id not in done]
    output_fn(f"The rules the assistant was given ({policy.product}):")
    for number, rule in enumerate(policy.rules, 1):
        output_fn(_wrap(f"{number}. {rule}", indent=2, hang=5))
    output_fn("")
    if not todo:
        output_fn(f"All {len(outputs)} outputs already have a label. Nothing to do.")
        return ReviewResult(0, 0, 0, stopped_early=False)
    output_fn(
        f"{len(done)} of {len(outputs)} labelled. {len(todo)} to go. "
        "Keys: p pass, f fail, s skip, q quit."
    )
    labelled = skipped = 0
    for index, output in enumerate(todo, 1):
        output_fn("")
        for line in show(output, f"{index} of {len(todo)} this session"):
            output_fn(line)
        choice = _ask_choice(input_fn, output_fn)
        if choice is None or choice == "quit":
            return ReviewResult(labelled, skipped, len(todo) - labelled, True)
        if choice == "skip":
            skipped += 1
            continue
        verdict: Verdict = "pass" if choice == "pass" else "fail"
        note = _ask_note(input_fn, output_fn, required=verdict == "fail")
        if note is None:
            return ReviewResult(labelled, skipped, len(todo) - labelled, True)
        category = ""
        if verdict == "fail" and categories is not None:
            answer = _ask(
                input_fn,
                f"Category ({', '.join(categories) or 'none yet'}), "
                "or Enter for none: ",
            )
            if answer is None:
                return ReviewResult(labelled, skipped, len(todo) - labelled, True)
            category = answer.strip()
        stamp = clock().isoformat(timespec="seconds")
        append_label(labels_path, Label(output.id, verdict, note, stamp, category))
        labelled += 1
    return ReviewResult(labelled, skipped, len(todo) - labelled, False)


def show(output: Output, position: str) -> list[str]:
    """The lines that present one output: message, facts, reply."""
    lines = [f"=== {output.id}  ({position}) ===", "Customer:"]
    lines.append(_wrap(output.customer, indent=2))
    lines.append("Facts the assistant could see:")
    lines += [_wrap(fact, indent=2) for fact in format_facts(output.facts)]
    lines.append("Reply:")
    lines.append(_wrap(output.reply, indent=2))
    lines.append(f"({len(output.reply.split())} words)")
    return lines


def _ask(input_fn: InputFn, prompt: str) -> str | None:
    try:
        return input_fn(prompt)
    except EOFError:
        return None


def _ask_choice(input_fn: InputFn, output_fn: OutputFn) -> str | None:
    while True:
        answer = _ask(input_fn, "p pass, f fail, s skip, q quit > ")
        if answer is None:
            return None
        key = answer.strip().lower()[:1]
        if key in KEYS:
            return KEYS[key]
        output_fn("Type p, f, s or q.")


def _ask_note(input_fn: InputFn, output_fn: OutputFn, *, required: bool) -> str | None:
    prompt = (
        "Note, the first thing that went wrong: "
        if required
        else "Note (Enter for none): "
    )
    while True:
        answer = _ask(input_fn, prompt)
        if answer is None:
            return None
        note = " ".join(answer.split())
        if note or not required:
            return note
        output_fn("A failing output needs a note. A few words are enough.")


def _wrap(text: str, indent: int, hang: int | None = None) -> str:
    return textwrap.fill(
        text,
        width=WRAP,
        initial_indent=" " * indent,
        subsequent_indent=" " * (indent if hang is None else hang),
        break_on_hyphens=False,
    )


def main(
    argv: Sequence[str] | None = None,
    *,
    input_fn: InputFn = input,
    output_fn: OutputFn = print,
    work_dir: Path = WORK_DIR,
    runs_dir: Path = fresh.RUNS_DIR,
    clock: Clock = utc_now,
) -> int:
    """Run a review session. Returns the process exit code."""
    parser = argparse.ArgumentParser(description="Label outputs by hand.")
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="review the newest model run in runs/ instead of data/outputs.jsonl",
    )
    args = parser.parse_args(sys.argv[1:] if argv is None else list(argv))
    try:
        policy = load_policy(DEFAULT_POLICY)
        if args.fresh:
            run_path = fresh.newest(runs_dir)
            if run_path is None:
                output_fn(
                    "No model run in runs/ yet. Generate fresh outputs with "
                    "uv run python run.py --model, then run this again."
                )
                return 0
            outputs = fresh.outputs(run_path, load_scenarios(DEFAULT_SCENARIOS))
            if not outputs:
                output_fn(fresh.no_replies_message(run_path))
                return 0
            labels_path = fresh.labels_path(run_path, work_dir)
            categories = _categories(work_dir / "taxonomy.md")
            output_fn(f"Fresh outputs from {run_path.name}.")
        else:
            outputs = load_outputs(DEFAULT_OUTPUTS)
            labels_path = work_dir / DEFAULT_LABELS.name
            categories = None
    except (RecordError, fresh.RunFileError, OSError) as exc:
        output_fn(f"Cannot start: {exc}")
        return 1
    try:
        result = review(
            outputs,
            policy,
            labels_path,
            input_fn,
            output_fn,
            categories=categories,
            clock=clock,
        )
    except KeyboardInterrupt:
        output_fn("")
        output_fn("Stopped. Every label you gave is saved. Run again to continue.")
        return 0
    output_fn("")
    output_fn(
        f"Labelled {result.labelled} this session, skipped {result.skipped}. "
        f"Labels are in {labels_path.name}."
    )
    if result.remaining:
        output_fn(f"{result.remaining} still to label. Run the same command again.")
    else:
        output_fn("Next: uv run python run.py")
    return 0


def _categories(path: Path) -> list[str]:
    if not path.exists():
        return []
    return [
        name
        for name in taxonomy.parse(path.read_text(encoding="utf-8")).names()
        if name != taxonomy.UNGROUPED
    ]


if __name__ == "__main__":
    raise SystemExit(main())
