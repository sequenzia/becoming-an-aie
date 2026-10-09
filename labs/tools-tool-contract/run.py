"""The lab: the contract, the validator on fixture calls, the plan, the live
calls, and the report.

uv run python run.py --dry-run     parts 1 to 3, no call
uv run python run.py               the full run, one call per request
uv run python run.py --limit 2     at most two calls this time
uv run python run.py --resume      continue the newest run for this model

With no API key it prints what it would do and exits 0. Provider code lives
in adapter.py. This file only calls adapter.complete.
"""

import argparse
import json
import os
import sys
import textwrap
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import TextIO

import adapter
import prices
import report
import runlog
from adapter import Provider, TaskFailure, TaskRequest, TaskResult, ToolCall
from contract import RULES, TOOL, Accepted, Session, validate
from executor import error_result, execute
from scenarios import (
    DEFAULT_FIXTURE_CALLS,
    DEFAULT_REQUESTS,
    Request,
    ScenarioError,
    load_fixture_calls,
    load_requests,
    system_prompt,
)
from store import DEFAULT_ORDERS, OrderStore, StoreError, load_store

RUNS_DIR = Path(__file__).parent / "runs"
WRAP = 79
FIRST_CALL_COMMAND = "uv run python first_call.py"

PER_REQUEST_FAILURES = ("no_tool_call", "refusal", "empty")
"""Failures about one request. The loop records them and moves on.

Every other failure is about the provider or the setup, so the next request
would fail the same way. Those stop the loop.
"""

CompleteFn = Callable[[TaskRequest], TaskResult | TaskFailure]
Clock = Callable[[], datetime]


def utc_now() -> datetime:
    """The current time in UTC."""
    return datetime.now(UTC)


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """The three flags the lab honors."""
    parser = argparse.ArgumentParser(
        description="A tool contract with validation: lookup_order."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the contract, the fixture verdicts and the plan, then stop",
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


def tool_definition_text() -> str:
    """The tool definition as the provider receives it, for the token estimate."""
    return json.dumps(
        {
            "name": TOOL.name,
            "description": TOOL.description,
            "input_schema": TOOL.input_schema,
        }
    )


def estimate_input(requests: list[Request], store: OrderStore) -> int:
    """Estimated input tokens for these requests, tool definition included."""
    tool = tool_definition_text()
    total = 0
    for request in requests:
        customer = store.customer(request.customer_id)
        name = customer.name if customer is not None else ""
        text = system_prompt(name) + request.message + tool
        total += prices.estimate_input_tokens(text, with_tool=True)
    return total


def cost_statement(model: str, calls: int, input_tokens: int) -> str:
    """The plain-language cost estimate printed before any paid call."""
    output_tokens = calls * prices.ESTIMATED_OUTPUT_TOKENS
    per_call = round(input_tokens / calls) if calls else 0
    head = (
        f"{calls} call{'s' if calls != 1 else ''}. About {input_tokens:,} input "
        f"tokens in total (roughly {per_call} per call, with the tool "
        f"definition) and {output_tokens:,} output tokens "
        f"({prices.ESTIMATED_OUTPUT_TOKENS} per call, which includes the "
        "model's reasoning tokens and the tool call)."
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
    orders_path: Path = DEFAULT_ORDERS,
    requests_path: Path = DEFAULT_REQUESTS,
    fixture_calls_path: Path = DEFAULT_FIXTURE_CALLS,
    out: TextIO | None = None,
    clock: Clock = utc_now,
) -> int:
    """Run the lab. Returns the process exit code."""
    stream = out if out is not None else sys.stdout
    environ = os.environ if env is None else env
    args = parse_args(sys.argv[1:] if argv is None else argv)

    def say(text: str = "") -> None:
        print(text, file=stream)

    def para(text: str, indent: int = 0) -> None:
        pad = " " * indent
        hang = pad + (" " * 2 if text.startswith("- ") else "")
        say(
            textwrap.fill(
                text,
                width=WRAP,
                initial_indent=pad,
                subsequent_indent=hang,
                break_on_hyphens=False,
            )
        )

    try:
        store = load_store(orders_path)
        requests = load_requests(store, requests_path)
        fixture_calls = load_fixture_calls(store, fixture_calls_path)
    except (StoreError, ScenarioError) as exc:
        say(f"Cannot start: {exc}")
        return 1

    say("A tool contract with validation")
    say("=" * 31)
    para(
        "One tool, lookup_order, for the Cedar Support customer portal. A "
        "signed-in customer asks about an order. The model proposes a call. "
        "Code decides whether it runs. Every customer, order and message here "
        "is synthetic."
    )
    say()
    say("Part 1. The contract the caller reads.")
    say(f"  name: {TOOL.name}")
    para(f"description: {TOOL.description}", indent=2)
    say("  input_schema:")
    say(textwrap.indent(json.dumps(TOOL.input_schema, indent=2), "    "))
    say("  Rules the schema cannot express, enforced in code:")
    for rule in RULES:
        para(f"- {rule}", indent=2)
    say()

    say("Part 2. The validator on hand-written calls. No model, no cost.")
    outcomes = report.check_fixture_calls(fixture_calls, store)
    say(report.format_fixture_table(outcomes))
    say()

    provider = adapter.pick_provider(environ)
    run_path, done = _run_file(provider, environ, args.resume, runs_dir, clock, para)
    todo = [request for request in requests if request.id not in done]
    if args.limit is not None:
        todo = todo[: args.limit]

    say("Part 3. The plan, before any paid call.")
    para(
        "The live step sends each customer request to the model through "
        "adapter.complete with lookup_order attached, one call per request, "
        "one at a time, at low effort. The validator checks the returned call "
        "before anything runs. Only an accepted call reaches the executor. "
        "Then the report says which calls were accepted, which were rejected, "
        "and why."
    )
    if done:
        para(
            f"{len(done)} of {len(requests)} requests already have a verdict "
            f"in {run_path.name}. They are skipped."
        )
    input_tokens = estimate_input(todo, store)
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

    say(f"Part 4. The live calls. Writing {run_path.name}.")
    for request in todo:
        outcome = _ask(request, store, complete_fn)
        if isinstance(outcome, TaskFailure):
            runlog.append(
                run_path,
                runlog.from_failure(
                    request.id,
                    request.customer_id,
                    outcome,
                    model,
                    provider,
                    _stamp_iso(clock),
                ),
            )
            say(f"  {request.id}  no verdict")
            para(adapter.explain(outcome), indent=6)
            if outcome.kind in PER_REQUEST_FAILURES:
                para(
                    "Recorded for this request. The loop moves on. Run again "
                    "with --resume to ask again for the requests without a "
                    "verdict.",
                    indent=6,
                )
                continue
            if outcome.retryable:
                para(
                    f"Run the same command again with --resume to continue "
                    f"from {request.id}. Verdicts so far are saved in "
                    f"{run_path.name}."
                )
            else:
                para(
                    "Fix the cause, then run again. Add --resume to keep the "
                    f"verdicts saved in {run_path.name}."
                )
            return 1
        result, call = outcome
        verdict = validate(
            call.name, call.arguments, Session(request.customer_id), store
        )
        tool_result = (
            execute(verdict, store)
            if isinstance(verdict, Accepted)
            else error_result(verdict)
        )
        record = runlog.from_verdict(
            request.id,
            request.customer_id,
            result,
            call,
            verdict,
            tool_result,
            _stamp_iso(clock),
        )
        runlog.append(run_path, record)
        say(_progress(record))

    records = runlog.read(run_path) if run_path.exists() else []
    remaining = len(requests) - len(runlog.answered(records))
    if remaining:
        say()
        para(
            f"{remaining} request{'s' if remaining != 1 else ''} still without a "
            "verdict. Run again with --resume to continue."
        )
    say()
    say("Part 5. The report.")
    say(report.format_report(report.summarize(requests, records), store))
    return 0


def _ask(
    request: Request, store: OrderStore, complete_fn: CompleteFn
) -> tuple[TaskResult, ToolCall] | TaskFailure:
    """One model call with the tool attached. A result must carry a tool call."""
    customer = store.customer(request.customer_id)
    name = customer.name if customer is not None else request.customer_id
    result = complete_fn(
        TaskRequest(system=system_prompt(name), user=request.message, tool=TOOL)
    )
    if isinstance(result, TaskFailure):
        return result
    if result.tool_call is None:
        return TaskFailure(
            "no_tool_call", "The result carried no tool call.", retryable=True
        )
    return result, result.tool_call


def _progress(record: runlog.Record) -> str:
    said = record.verdict
    if record.verdict == "rejected" and record.error_kinds:
        said = f"rejected ({record.error_kinds[0]})"
    order = str((record.arguments or {}).get("order_id", "?"))
    seconds = record.latency_ms / 1000
    return f"  {record.id}  {order:<12} {said:<26} {seconds:.2f} s"


def _run_file(
    provider: Provider | None,
    env: Mapping[str, str],
    resume: bool,
    runs_dir: Path,
    clock: Clock,
    para: Callable[[str], None],
) -> tuple[Path, set[str]]:
    """The run file to write, and the request ids it already decided."""
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


def _stamp_iso(clock: Clock) -> str:
    return clock().isoformat(timespec="seconds")


def _positive(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return number


if __name__ == "__main__":
    raise SystemExit(main())
