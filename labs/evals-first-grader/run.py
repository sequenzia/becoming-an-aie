"""The lab: your review, the taxonomy, your grader against your labels, then
an optional model step.

uv run python run.py                 parts 1 to 3, and the plan for part 4
uv run python run.py --dry-run       the same, and stop before any paid call
uv run python run.py --model         part 4: 20 fresh outputs through the model
uv run python run.py --model --limit 5     at most five calls this time
uv run python run.py --model --resume      continue the newest model run

Parts 1 to 3 need no key and cost nothing. With no API key the lab prints
what part 4 would do and exits 0. Provider code lives in adapter.py. This
file only calls adapter.complete.
"""

import argparse
import os
import sys
import textwrap
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TextIO

import adapter
import agreement
import fresh
import grader
import prices
import taxonomy
from adapter import Provider, TaskFailure, TaskRequest, TaskResult
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
    Scenario,
    latest,
    load_outputs,
    load_policy,
    load_scenarios,
    read_labels,
)

WRAP = 79
FIRST_CALL_COMMAND = "uv run python first_call.py"
REVIEW_TIME = "The review takes 10 to 15 minutes for all 30 outputs:"
ENOUGH_LABELS = 20
REVIEW_COMMAND = "uv run python review.py"
REFERENCE_COMMAND = (
    "uv run python run.py --labels data/reference_labels.jsonl "
    "--taxonomy data/reference_taxonomy.md"
)

CompleteFn = Callable[[TaskRequest], TaskResult | TaskFailure]
Clock = Callable[[], datetime]
Say = Callable[[str], None]


@dataclass(frozen=True)
class Paths:
    """Where the lab reads and writes. Tests point these at a temp folder."""

    outputs: Path = DEFAULT_OUTPUTS
    scenarios: Path = DEFAULT_SCENARIOS
    policy: Path = DEFAULT_POLICY
    work_dir: Path = WORK_DIR
    runs_dir: Path = fresh.RUNS_DIR


def utc_now() -> datetime:
    """The current time in UTC."""
    return datetime.now(UTC)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """The flags the lab honors."""
    parser = argparse.ArgumentParser(
        description="Review outputs, build a taxonomy, measure your first grader."
    )
    parser.add_argument(
        "--labels",
        type=Path,
        default=None,
        metavar="FILE",
        help="labels to use instead of work/labels.jsonl",
    )
    parser.add_argument(
        "--taxonomy",
        type=Path,
        default=None,
        metavar="FILE",
        help="an edited taxonomy to use instead of work/taxonomy.md",
    )
    parser.add_argument(
        "--model",
        action="store_true",
        help="part 4: generate fresh outputs through the model (paid)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the plan and the cost estimate, then stop before any call",
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
        help="continue the newest model run for this provider and model",
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
        f"{prices.order_of_magnitude(dollars)}. If every reply ran five times "
        f"longer it would be about {prices.format_dollars(longer)}, "
        f"{_still(dollars, longer)}."
    )


def human_positives(
    labels: dict[str, Label], category_ids: set[str] | None
) -> dict[str, bool]:
    """Your verdict per id: True when the failure the grader checks is present.

    With category_ids, a fail counts only when it is filed under the grader's
    category. Without it, every fail counts.
    """
    return {
        key: label.label == "fail" and (category_ids is None or key in category_ids)
        for key, label in labels.items()
    }


def grader_flags(outputs: list[Output]) -> dict[str, grader.Verdict]:
    """The grader's verdict on every output."""
    return {output.id: grader.grade(output) for output in outputs}


def main(
    argv: Sequence[str] | None = None,
    *,
    env: Mapping[str, str] | None = None,
    complete_fn: CompleteFn = adapter.complete,
    paths: Paths | None = None,
    out: TextIO | None = None,
    clock: Clock = utc_now,
) -> int:
    """Run the lab. Returns the process exit code."""
    stream = out if out is not None else sys.stdout
    environ = os.environ if env is None else env
    where = paths if paths is not None else Paths()
    args = parse_args(sys.argv[1:] if argv is None else argv)

    def say(text: str = "") -> None:
        print(text, file=stream)

    def para(text: str) -> None:
        if text.startswith("  uv run "):
            say(text)
            return
        say(
            textwrap.fill(
                text,
                width=WRAP,
                subsequent_indent=" " * _indent(text),
                break_on_hyphens=False,
            )
        )

    try:
        policy = load_policy(where.policy)
        outputs = load_outputs(where.outputs)
        scenarios = load_scenarios(where.scenarios)
        labels_path = args.labels or where.work_dir / DEFAULT_LABELS.name
        labels = latest(read_labels(labels_path))
    except (RecordError, OSError) as exc:
        say(f"Cannot start: {exc}")
        return 1
    known = {output.id for output in outputs}
    labels = {key: label for key, label in labels.items() if key in known}

    title = "Review outputs, then write a first grader"
    say(title)
    say("=" * len(title))
    para(
        f"{len(outputs)} synthetic replies from the support assistant of "
        f"{policy.product}, each with the facts it could see."
    )
    say()

    say("Part 1. Your review. No model, no cost.")
    _step_review(labels, len(outputs), labels_path, args.labels is not None, para)
    say()

    say("Part 2. The failure taxonomy.")
    tax = _step_taxonomy(labels, labels_path, args, where, say, para)
    say()

    say("Part 3. Your grader against your labels.")
    flags = grader_flags(outputs)
    category_ids = _step_target(tax, para) if labels else None
    _step_agreement(outputs, labels, flags, category_ids, say, para)
    _step_fresh_agreement(scenarios, tax, where, say, para)
    say()

    say("Part 4. The model step. Optional, and the only part that costs money.")
    return _step_model(
        args,
        environ,
        scenarios,
        policy,
        outputs,
        flags,
        where,
        complete_fn,
        clock,
        say,
        para,
    )


def _step_review(
    labels: dict[str, Label],
    total: int,
    labels_path: Path,
    custom: bool,
    para: Say,
) -> None:
    fails = sum(1 for label in labels.values() if label.label == "fail")
    source = str(labels_path) if custom else f"work/{labels_path.name}"
    if not labels:
        para(
            f"No labels in {source} yet. Read the outputs and label them by "
            f"hand first. {REVIEW_TIME}"
        )
        para(f"  {REVIEW_COMMAND}")
        para("Or see the rest of the lab with one reviewer's labels:")
        para(f"  {REFERENCE_COMMAND}")
        return
    para(
        f"{source}: {len(labels)} of {total} outputs labelled. "
        f"{len(labels) - fails} pass, {fails} fail."
    )
    if len(labels) < ENOUGH_LABELS:
        para(
            f"That is fewer than {ENOUGH_LABELS}. The numbers below are thin. "
            "Label more with:"
        )
        para(f"  {REVIEW_COMMAND}")


def _step_taxonomy(
    labels: dict[str, Label],
    labels_path: Path,
    args: argparse.Namespace,
    where: Paths,
    say: Say,
    para: Say,
) -> taxonomy.Taxonomy | None:
    fails = sum(1 for label in labels.values() if label.label == "fail")
    if args.taxonomy is not None:
        try:
            tax = taxonomy.parse(args.taxonomy.read_text(encoding="utf-8"))
        except OSError as exc:
            para(f"Cannot read {args.taxonomy}: {exc.strerror}.")
            return None
        para(f"Read {args.taxonomy}.")
    elif not fails:
        para("No failing labels yet, so there is nothing to group.")
        return None
    else:
        path = where.work_dir / "taxonomy.md"
        if args.labels is not None:
            tax = taxonomy.propose(labels)
            para(
                f"Proposed from the notes in {labels_path.name}. Not written "
                "to a file, because --labels points away from your own labels. "
                "Pass --taxonomy with an edited file to use one."
            )
        elif path.exists():
            tax = taxonomy.parse(path.read_text(encoding="utf-8"))
            para(f"Read work/{path.name}, the file you edit.")
        else:
            tax = taxonomy.propose(labels)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                taxonomy.render(tax, f"work/{labels_path.name}"), encoding="utf-8"
            )
            para(
                f"Grouped your {fails} failing notes by the words they share "
                f"and wrote work/{path.name}. The grouping is crude on purpose. "
                "Open the file, rename each group in the product's terms, move "
                "ids that landed in the wrong place, and write the definitions. "
                "Then run this again."
            )
    ranked = taxonomy.counts(tax)
    filed = sum(count for _, count in ranked)
    if not ranked:
        para("The taxonomy has no categories yet.")
        return tax
    say()
    for category, count in ranked:
        share = agreement.percent(count / fails) if fails else "n/a"
        say(f"  {category.name:<24} {count:>3}   {share:>4} of failures")
    say(f"  {'total filed':<24} {filed:>3}   of {fails} failing labels")
    for problem in taxonomy.problems(tax, labels):
        para(f"- {problem}")
    top, top_count = ranked[0]
    if top_count:
        say()
        para(
            f"Most common: {top.name}, {top_count} of {fails} failures. That is "
            "the first failure to write a grader for."
        )
    return tax


def _step_target(tax: taxonomy.Taxonomy | None, para: Say) -> set[str] | None:
    para(f"grader.py checks the category named {grader.CATEGORY!r}.")
    category = tax.find(grader.CATEGORY) if tax is not None else None
    if category is None:
        names = ", ".join(tax.names()) if tax is not None else "none yet"
        para(
            f"{grader.CATEGORY!r} is not a category in your taxonomy "
            f"(categories: {names}). Until it is, every fail label counts as "
            "a failure the grader should catch, so failures it was never meant "
            "to catch count against it. Rename a category, or set CATEGORY in "
            "grader.py to the one you want to check."
        )
        return None
    ranked = taxonomy.counts(tax) if tax is not None else []
    if ranked and ranked[0][0].name != category.name:
        para(
            f"Your most common category is {ranked[0][0].name}, not "
            f"{category.name}. Consider writing the grader for that one."
        )
    para(
        f"Your failures for it: the {len(category.ids)} fail labels filed "
        f"under {category.name}. Fails in other categories count as no "
        "failure for this grader."
    )
    return category.ids


def _step_agreement(
    outputs: list[Output],
    labels: dict[str, Label],
    flags: dict[str, grader.Verdict],
    category_ids: set[str] | None,
    say: Say,
    para: Say,
) -> None:
    flagged = sum(1 for verdict in flags.values() if not verdict.passed)
    para(f"The grader flags {flagged} of {len(outputs)} outputs.")
    if not labels:
        para("There is nothing to compare it with until you label outputs.")
        return
    human = human_positives(labels, category_ids)
    result = agreement.measure(human, {k: not v.passed for k, v in flags.items()})
    say()
    for line in agreement.table(result):
        say(line)
    _disagreements(result, labels, flags, say, para)


def _disagreements(
    result: agreement.Agreement,
    labels: dict[str, Label],
    flags: dict[str, grader.Verdict],
    say: Say,
    para: Say,
) -> None:
    if result.misses:
        say()
        say("  Misses: you say failure, the grader passed it.")
        for item in result.misses:
            para(f"  - {item}. You: {labels[item].note or '(no note)'}")
    if result.false_alarms:
        say()
        say("  False alarms: the grader flagged it, you did not.")
        for item in result.false_alarms:
            label = labels[item]
            yours = label.label + (f", {label.note}" if label.note else "")
            para(f"  - {item}. Grader: {flags[item].reason}. You: {yours}.")
    if result.misses or result.false_alarms:
        say()
        para(
            "Read each one. Is the grader wrong, is your label wrong, or is "
            "the rule unclear? Change grader.py or your labels, and run again."
        )


def _step_fresh_agreement(
    scenarios: list[Scenario],
    tax: taxonomy.Taxonomy | None,
    where: Paths,
    say: Say,
    para: Say,
) -> None:
    run_path = fresh.newest(where.runs_dir)
    if run_path is None:
        return
    labels_path = fresh.labels_path(run_path, where.work_dir)
    try:
        outputs = fresh.outputs(run_path, scenarios)
        labels = latest(read_labels(labels_path))
    except (fresh.RunFileError, RecordError) as exc:
        para(f"Cannot read the fresh outputs: {exc}")
        return
    say()
    if not outputs:
        para(fresh.no_replies_message(run_path))
        return
    if not labels:
        para(
            f"Fresh outputs from {run_path.name} have no labels yet. Label them "
            "to see whether the grader holds on outputs it was not written "
            "against:"
        )
        para("  uv run python review.py --fresh")
        return
    target = tax.find(grader.CATEGORY) if tax is not None else None
    human = {
        key: label.label == "fail"
        and (target is None or _same(label.category, target.name))
        for key, label in labels.items()
    }
    flags = grader_flags(outputs)
    result = agreement.measure(human, {k: not v.passed for k, v in flags.items()})
    para(f"On the fresh outputs in {run_path.name}, labelled by you:")
    for line in agreement.table(result):
        say(line)
    _disagreements(result, labels, flags, say, para)


def _step_model(
    args: argparse.Namespace,
    environ: Mapping[str, str],
    scenarios: list[Scenario],
    policy: Policy,
    outputs: list[Output],
    flags: dict[str, grader.Verdict],
    where: Paths,
    complete_fn: CompleteFn,
    clock: Clock,
    say: Say,
    para: Say,
) -> int:
    provider = adapter.pick_provider(environ)
    run_path, done = _run_file(provider, environ, args.resume, where, clock, para)
    todo = [scenario for scenario in scenarios if scenario.id not in done]
    if args.limit is not None:
        todo = todo[: args.limit]
    system = fresh.system_prompt(policy)
    para(
        f"The model writes one reply for each of the {len(scenarios)} customer "
        "messages in data/scenarios.jsonl, through adapter.complete, one call "
        "at a time, at low effort, under the same rules. Then your grader runs "
        "on the fresh replies, and you can label them by hand to see whether "
        "it still agrees with you."
    )
    if done:
        para(
            f"{len(done)} of {len(scenarios)} already have a reply in "
            f"{run_path.name}. They are skipped."
        )
    input_tokens = sum(
        prices.estimate_input_tokens(system + fresh.user_message(s)) for s in todo
    )
    say()
    if provider is None:
        para("Cost estimate, for each default model:")
        for name in (adapter.DEFAULT_ANTHROPIC_MODEL, adapter.DEFAULT_OPENAI_MODEL):
            para(f"- {cost_statement(name, len(todo), input_tokens)}")
        say()
        para(
            "No ANTHROPIC_API_KEY or OPENAI_API_KEY is set, so the lab stops "
            "here and makes no call. Parts 1 to 3 never need one. To run part "
            "4, set one of them, then start with the raw call, one call before "
            "the adapter:"
        )
        para(f"  {FIRST_CALL_COMMAND}")
        para("Then run part 4:")
        para("  uv run python run.py --model")
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
    if not args.model:
        para("No call made. To run this part, add --model:")
        para("  uv run python run.py --model")
        return 0
    if not todo:
        para("Every scenario already has a reply. Nothing to call.")
    else:
        say(f"Writing {run_path.name}.")
    for scenario in todo:
        result = complete_fn(
            TaskRequest(system=system, user=fresh.user_message(scenario))
        )
        stamp = clock().isoformat(timespec="seconds")
        if isinstance(result, TaskFailure):
            fresh.append(
                run_path,
                fresh.from_failure(scenario.id, result, model, provider, stamp),
            )
            say(f"  {scenario.id}  failed")
            para(adapter.explain(result))
            if result.retryable:
                para(
                    "Run the same command again with --resume to continue from "
                    f"{scenario.id}. Replies so far are saved in {run_path.name}."
                )
            else:
                para(
                    "Fix the cause, then run again. Add --resume to keep the "
                    f"replies saved in {run_path.name}."
                )
            return 1
        fresh.append(run_path, fresh.from_result(scenario.id, result, stamp))
        say(
            f"  {scenario.id}  {len(result.text.split()):>3} words  "
            f"{result.latency_ms / 1000:.2f} s"
        )
    _report_fresh(run_path, scenarios, outputs, flags, where, say, para)
    return 0


def _report_fresh(
    run_path: Path,
    scenarios: list[Scenario],
    outputs: list[Output],
    flags: dict[str, grader.Verdict],
    where: Paths,
    say: Say,
    para: Say,
) -> None:
    if not run_path.exists():
        return
    records = fresh.read(run_path)
    fresh_outputs = fresh.outputs(run_path, scenarios)
    remaining = len(scenarios) - len(fresh_outputs)
    say()
    if remaining:
        para(
            f"{remaining} scenario{'s' if remaining != 1 else ''} still without "
            "a reply. Run again with --model --resume to continue."
        )
    fresh_flags = grader_flags(fresh_outputs)
    for output in fresh_outputs:
        verdict = fresh_flags[output.id]
        line = f"  {output.id}  grader {'pass' if verdict.passed else 'FLAG'}"
        para(line + (f": {verdict.reason}" if verdict.reason else ""))
    answered = fresh.answered(records).values()
    tokens_in = sum(r.input_tokens for r in answered)
    tokens_out = sum(r.output_tokens for r in answered)
    models = sorted({f"{r.model} ({r.provider})" for r in answered})
    flagged = sum(1 for v in fresh_flags.values() if not v.passed)
    reviewed = sum(1 for v in flags.values() if not v.passed)
    say()
    para(
        f"The grader flags {flagged} of {len(fresh_outputs)} fresh replies, "
        f"against {reviewed} of {len(outputs)} reviewed ones."
    )
    para(_actual_cost(models, tokens_in, tokens_out))
    para(
        "A flag rate is not agreement. Label the fresh replies by hand, then "
        "run this again to see the grader's agreement on them:"
    )
    para("  uv run python review.py --fresh")


def _actual_cost(models: list[str], tokens_in: int, tokens_out: int) -> str:
    served = ", ".join(models) or "none"
    text = (
        f"Served model: {served}. Tokens: {tokens_in:,} input, {tokens_out:,} output."
    )
    price = prices.lookup(models[0].split(" ")[0]) if len(models) == 1 else None
    if price is None:
        return text
    dollars = prices.cost_usd(price, tokens_in, tokens_out)
    return (
        f"{text} At {prices.format_price(price)}, that is about "
        f"{prices.format_dollars(dollars)}."
    )


def _run_file(
    provider: Provider | None,
    env: Mapping[str, str],
    resume: bool,
    where: Paths,
    clock: Clock,
    para: Say,
) -> tuple[Path, set[str]]:
    """The run file to write, and the scenario ids it already answered."""
    name = provider or "none"
    model = model_for(provider, env) if provider is not None else "none"
    if resume and provider is not None:
        found = fresh.newest(where.runs_dir, name, model)
        if found is None:
            para(f"No earlier run for {name} {model} in runs/. Starting a new run.")
        else:
            try:
                return found, set(fresh.answered(fresh.read(found)))
            except fresh.RunFileError as exc:
                para(f"Cannot resume from {found.name}: {exc} Starting a new run.")
    stamp = clock().strftime("%Y%m%dT%H%M%SZ")
    return where.runs_dir / fresh.run_file_name(stamp, name, model), set()


def _still(dollars: float, longer: float) -> str:
    size = prices.order_of_magnitude(longer)
    if size == prices.order_of_magnitude(dollars):
        return f"still {size}"
    return size


def _same(a: str, b: str) -> bool:
    return a.strip().lower() == b.strip().lower()


def _indent(text: str) -> int:
    if text.startswith("  - "):
        return 4
    if text.startswith("- ") or text.startswith("  "):
        return 2
    return 0


def _positive(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return number


if __name__ == "__main__":
    raise SystemExit(main())
