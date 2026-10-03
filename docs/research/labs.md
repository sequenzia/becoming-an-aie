# Labs research: the optional Python code labs

Date: 2026-09-15. Scope: spec section 5.7 (Optional code labs) plus the author's 2026-09-15 decisions (uv, ruff, pytest, Python 3.12, commit per phase on main). The labs have no dependency on the Astro site.

## 0. What was verified, and how

| Item | Source | Result |
| --- | --- | --- |
| Anthropic Python SDK call shape, error classes, model ids, prices | `claude-api` skill (model table cached 2026-06-24) plus introspection of the installed `anthropic` 1.6.0 | `client.messages.create(model, max_tokens, system, messages, output_config, tools)`. No `temperature` parameter exists in 1.6.0. `Usage` has `input_tokens` and `output_tokens`. `Message.model` is the served model id. |
| OpenAI Python SDK call shape, error classes | ctx7 `/openai/openai-python` plus introspection of the installed `openai` 3.14.1 | `client.responses.create(model, instructions, input, max_output_tokens, reasoning, temperature, tools)`. `Response.output_text`, `Response.usage.input_tokens`, `Response.usage.output_tokens`, `Response.model`. |
| OpenAI model ids | ctx7 `/websites/developers_openai_api` plus a free `client.models.retrieve` call against the live models endpoint | Guides print `gpt-5.6`, but that id returns 404. `gpt-5.6-sol`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-mini` and `gpt-5-mini` resolve. No paid call was made. |
| OpenAI prices | ctx7 pricing page | `gpt-5.6-sol` $4.00 in, $20.00 out per 1M (short context). `gpt-5.5` $5.00 in, $30.00 out. `gpt-5-mini` $0.25 in, $2.00 out. |
| uv conventions | ctx7 `/websites/astral_sh_uv` plus `uv` 0.11.7 locally | `uv init --app --python 3.12` writes `[project]` with `requires-python = ">=3.12"`, `.python-version`, `main.py`, `README.md`. `uv add --dev` writes `[dependency-groups] dev`. A plain `uv sync` installs the dev group. `uv run` syncs then runs. |
| Ruff configuration | ctx7 `/websites/astral_sh_ruff` plus `ruff config` on the installed 0.16.7 | Default `line-length` 88. `target-version` is inferred from `requires-python`. `lint.select` replaces the default set. Formatter defaults: double quotes, spaces. `format.docstring-code-format` defaults to false. `ANN401` forbids `Any`. `ANN101` and `ANN102` were removed in 0.8. |
| The adapter and the two non-model modules below | Scratch project at `scratchpad/sdkcheck` with the proposed `pyproject.toml` | `ruff check .` clean, `ruff format --check .` clean, 19 tests pass, the no-key path returns `TaskFailure(kind="no_api_key")` with both keys unset. |

Versions on this machine: uv 0.11.7, Python 3.12.13 (uv-managed), ruff 0.16.7, pytest 9.1.1, anthropic 1.6.0, openai 3.14.1, Node 24.15.0. No global `ruff` or `python3.12` on PATH. Both come through `uv run`.

Not verified: Anthropic ids against the live API (no `ANTHROPIC_API_KEY` in this shell). The skill's table is the source. Whether `gpt-5.6-sol` accepts a non-default `temperature` (see 2.5).

## 1. Requirements checklist

Restated from spec 5.7, with how the design meets each one.

- [ ] Each lab is a standalone directory under `labs/` with its own `pyproject.toml`. Design: three directories, each created with `uv init --app`, each with its own `uv.lock` and `.venv`. No root `pyproject.toml` under `labs/`.
- [ ] Managed with uv. Design: `uv sync`, `uv run`, `uv add`, `uv lock`. Python pinned to 3.12 in `.python-version` and `requires-python`.
- [ ] Formatted and linted with ruff. Design: one `[tool.ruff]` block copied into every lab (section 4). `ruff format` and `ruff check` both clean before each commit.
- [ ] Type hints on all functions. Design: ruff `ANN` rules enforce it, including in tests. `ANN401` bans `Any`; the code uses `object` where the shape is open.
- [ ] A thin adapter: one function that takes a task request and returns text, usage, timing and model identity, with a typed failure. Design: `complete(request: TaskRequest) -> TaskResult | TaskFailure` in `adapter.py`.
- [ ] Provider-specific code lives only in the adapter. Design: `import anthropic` and `import openai` appear in `adapter.py` and in `first_call.py` only. `first_call.py` exists because the spec also asks for explicit calls before abstraction.
- [ ] Each lab runs to completion in under ten minutes on a laptop. Design: 25 or fewer sequential calls at low reasoning effort, plus a `--limit` flag. Time budgets are in section 3.
- [ ] Each lab states its expected cost order of magnitude before any paid call. Design: `run.py` prints a computed estimate from `prices.py`, then a plain-language line ("cents", "about one cent"), before the first call. `--dry-run` stops there.
- [ ] Each lab has a pytest test that exercises the non-model logic without an API key. Design: `tests/` per lab. No test imports a provider client. `test_adapter.py` unsets both keys and asserts the typed failure.
- [ ] Labs are marked optional everywhere they appear and never count toward completion. Design: site-side concern. Each lab README opens with "This lab is optional and does not count toward module completion."
- [ ] Labs teach explicit model calls before any abstraction. Design: each lab's step 1 is `first_call.py`, one raw SDK call per provider. The adapter is introduced in step 2 as "the same call, wrapped once".
- [ ] Labs exist for Models (Chapter 3 first measurable feature), Tools (tool contract with validation), Verification and evals (review 20 to 50 outputs, write a first grader). Design: section 3.
- [ ] No API key present: the lab explains what it would do and exits cleanly. Design: `run.py` checks `pick_provider(os.environ)` first, prints the plan and the cost statement, says which variable to set, and returns exit code 0.
- [ ] Provider error mid-lab: the typed failure is shown and the lab suggests the retry. Design: every call site prints `explain(failure)`. Retryable kinds say "run the same command again with `--resume`". Progress is written per case so a rerun continues.

## 2. Adapter design

### 2.1 Types

The request asked for `TaskRequest(system, user, max_tokens, temperature)`, `TaskResult(text, input_tokens, output_tokens, latency_ms, model, provider)` and `TaskFailure(kind, message, retryable)`. The verified adapter keeps those fields and adds three things, each forced by a verified fact:

1. `TaskRequest.temperature` is `float | None`, default `None`. The installed `anthropic` 1.6.0 has no `temperature` parameter on `messages.create`, and the skill records that Claude Opus 5, Opus 4.8, Opus 4.7 and Fable 5 return 400 if it is sent. The adapter forwards `temperature` to OpenAI only when it is set, and never to Anthropic.
2. `TaskRequest.tool: ToolSpec | None` and `TaskResult.tool_call: ToolCall | None`. The Tools lab must get one real tool call back through the same single function. Both default to `None`, so the Models and Evals labs never see them.
3. `TaskRequest.max_tokens` defaults to 4096, not a few hundred. On Claude Opus 5 thinking is on by default and counts toward `max_tokens`. On gpt-5.x reasoning tokens count toward `max_output_tokens`. A low cap truncates classification answers.

`FailureKind` is a `Literal` of ten strings: `no_api_key`, `auth`, `rate_limit`, `server`, `network`, `bad_request`, `refusal`, `truncated`, `no_tool_call`, `empty`. `retryable` is `True` for `rate_limit`, `server`, `network`, `no_tool_call`, `empty`.

### 2.2 Provider selection

`pick_provider(env)` returns `"anthropic"` when `ANTHROPIC_API_KEY` is non-empty, else `"openai"` when `OPENAI_API_KEY` is non-empty, else `None`. Empty strings count as unset. It takes a `Mapping` so tests pass a dict. Model ids come from `LAB_ANTHROPIC_MODEL` and `LAB_OPENAI_MODEL` with the defaults below.

### 2.3 Verified raw provider calls (this is `first_call.py`)

Anthropic, verified against `anthropic` 1.6.0 and the skill's Python README:

```python
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY
message = client.messages.create(
    model="claude-opus-5",
    max_tokens=4096,
    system="Answer with one word.",
    messages=[{"role": "user", "content": "Is 'I was charged twice' a billing ticket?"}],
    output_config={"effort": "low"},
)
if message.stop_reason == "refusal":
    raise SystemExit("The model declined this request.")
text = "".join(block.text for block in message.content if block.type == "text")
print(text)
print(message.model, message.usage.input_tokens, message.usage.output_tokens)
```

Notes. `message.content` is a list of typed blocks; check `block.type` before reading `.text`. Thinking is on by default on Opus 5, so `output_tokens` includes thinking tokens. `output_config={"effort": "low"}` is the right lever for a one-word answer. Do not send `thinking={"type": "enabled", "budget_tokens": N}` or `temperature`; both return 400 on this model.

OpenAI, verified against `openai` 3.14.1 and ctx7 `/openai/openai-python`:

```python
from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY
response = client.responses.create(
    model="gpt-5.6-sol",
    instructions="Answer with one word.",
    input="Is 'I was charged twice' a billing ticket?",
    max_output_tokens=4096,
    reasoning={"effort": "low"},
)
print(response.output_text)
print(response.model, response.usage.input_tokens, response.usage.output_tokens)
```

Notes. The docs' guides print `gpt-5.6`, but the live models endpoint returns "The model 'gpt-5.6' does not exist". `gpt-5.6-sol` resolves and the pricing page calls it the flagship. `reasoning.effort` accepts `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. `response.usage` is typed `Optional`; the adapter guards it. `response.status == "incomplete"` with `incomplete_details.reason == "max_output_tokens"` is the truncation signal.

### 2.4 The adapter, verbatim as verified

This file passed `ruff check`, `ruff format --check` and its tests in the scratch project.

```python
"""Thin model adapter for the labs. Provider-specific code lives only here.

Every lab carries an identical copy of this file. The canonical copy is
labs/models-first-measurable-feature/adapter.py. Verified against
anthropic 1.6.0 and openai 3.14.1 on 2026-09-15.
"""

import json
import os
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

import anthropic
import openai
from anthropic.types import ToolParam
from openai.types.responses import FunctionToolParam

Provider = Literal["anthropic", "openai"]
FailureKind = Literal[
    "no_api_key",
    "auth",
    "rate_limit",
    "server",
    "network",
    "bad_request",
    "refusal",
    "truncated",
    "no_tool_call",
    "empty",
]

DEFAULT_ANTHROPIC_MODEL = "claude-opus-5"
DEFAULT_OPENAI_MODEL = "gpt-5.6-sol"


@dataclass(frozen=True)
class ToolSpec:
    """One tool the model may call. input_schema is plain JSON Schema."""

    name: str
    description: str
    input_schema: dict[str, object]


@dataclass(frozen=True)
class TaskRequest:
    """What a lab asks the model to do."""

    system: str
    user: str
    max_tokens: int = 4096
    temperature: float | None = None
    tool: ToolSpec | None = None


@dataclass(frozen=True)
class ToolCall:
    """A tool call the model produced. Arguments are already parsed."""

    name: str
    arguments: dict[str, object]


@dataclass(frozen=True)
class TaskResult:
    """A successful call."""

    text: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    model: str
    provider: Provider
    tool_call: ToolCall | None = None


@dataclass(frozen=True)
class TaskFailure:
    """A failed call. Labs print this and never show a stack trace."""

    kind: FailureKind
    message: str
    retryable: bool


def pick_provider(env: Mapping[str, str]) -> Provider | None:
    """Anthropic wins when both keys are set. Empty values count as unset."""
    if env.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if env.get("OPENAI_API_KEY"):
        return "openai"
    return None


def complete(request: TaskRequest) -> TaskResult | TaskFailure:
    """Run one request against the provider that has a key. Never raises."""
    provider = pick_provider(os.environ)
    if provider is None:
        return TaskFailure(
            kind="no_api_key",
            message="No ANTHROPIC_API_KEY or OPENAI_API_KEY in the environment.",
            retryable=False,
        )
    if provider == "anthropic":
        return _complete_anthropic(request)
    return _complete_openai(request)


def explain(failure: TaskFailure) -> str:
    """One line a lab prints when a call fails."""
    advice = (
        "Retryable: wait a few seconds and run the same command again."
        if failure.retryable
        else "Not retryable: fix the cause and run again."
    )
    return f"Model call failed ({failure.kind}): {failure.message} {advice}"


def _complete_anthropic(request: TaskRequest) -> TaskResult | TaskFailure:
    model = os.environ.get("LAB_ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)
    client = anthropic.Anthropic()
    tools: list[ToolParam] = []
    if request.tool is not None:
        tools.append(
            {
                "name": request.tool.name,
                "description": request.tool.description,
                "input_schema": request.tool.input_schema,
                "strict": True,
            }
        )
    started = time.perf_counter()
    try:
        message = client.messages.create(
            model=model,
            max_tokens=request.max_tokens,
            system=request.system,
            messages=[{"role": "user", "content": request.user}],
            output_config={"effort": "low"},
            tools=tools or anthropic.omit,
        )
    except anthropic.AuthenticationError as exc:
        return TaskFailure("auth", str(exc), retryable=False)
    except anthropic.RateLimitError as exc:
        return TaskFailure("rate_limit", str(exc), retryable=True)
    except anthropic.APIStatusError as exc:
        if exc.status_code >= 500:
            return TaskFailure("server", str(exc), retryable=True)
        return TaskFailure("bad_request", str(exc), retryable=False)
    except anthropic.APIConnectionError as exc:
        return TaskFailure("network", str(exc), retryable=True)
    latency_ms = round((time.perf_counter() - started) * 1000)
    if message.stop_reason == "refusal":
        return TaskFailure(
            "refusal", "The model declined this request.", retryable=False
        )
    if message.stop_reason == "max_tokens":
        return TaskFailure(
            "truncated", "Output hit max_tokens. Raise max_tokens.", retryable=False
        )
    text = "".join(block.text for block in message.content if block.type == "text")
    tool_call: ToolCall | None = None
    for block in message.content:
        if block.type == "tool_use":
            tool_call = ToolCall(name=block.name, arguments=block.input)
    return _finish(
        request,
        text=text,
        tool_call=tool_call,
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
        latency_ms=latency_ms,
        model=message.model,
        provider="anthropic",
    )


def _complete_openai(request: TaskRequest) -> TaskResult | TaskFailure:
    model = os.environ.get("LAB_OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
    client = openai.OpenAI()
    tools: list[FunctionToolParam] = []
    if request.tool is not None:
        tools.append(
            {
                "type": "function",
                "name": request.tool.name,
                "description": request.tool.description,
                "parameters": request.tool.input_schema,
                "strict": True,
            }
        )
    temperature = openai.omit if request.temperature is None else request.temperature
    started = time.perf_counter()
    try:
        response = client.responses.create(
            model=model,
            instructions=request.system,
            input=request.user,
            max_output_tokens=request.max_tokens,
            reasoning={"effort": "low"},
            temperature=temperature,
            tools=tools or openai.omit,
        )
    except openai.AuthenticationError as exc:
        return TaskFailure("auth", str(exc), retryable=False)
    except openai.RateLimitError as exc:
        return TaskFailure("rate_limit", str(exc), retryable=True)
    except openai.APIStatusError as exc:
        if exc.status_code >= 500:
            return TaskFailure("server", str(exc), retryable=True)
        return TaskFailure("bad_request", str(exc), retryable=False)
    except openai.APIConnectionError as exc:
        return TaskFailure("network", str(exc), retryable=True)
    latency_ms = round((time.perf_counter() - started) * 1000)
    if response.status == "incomplete":
        details = response.incomplete_details
        reason = details.reason if details is not None else "unknown"
        return TaskFailure(
            "truncated", f"Response incomplete: {reason}.", retryable=False
        )
    tool_call: ToolCall | None = None
    for item in response.output:
        if item.type == "message":
            for part in item.content:
                if part.type == "refusal":
                    return TaskFailure("refusal", part.refusal, retryable=False)
        if item.type == "function_call":
            parsed = json.loads(item.arguments)
            arguments = parsed if isinstance(parsed, dict) else {}
            tool_call = ToolCall(name=item.name, arguments=arguments)
    usage = response.usage
    return _finish(
        request,
        text=response.output_text,
        tool_call=tool_call,
        input_tokens=usage.input_tokens if usage is not None else 0,
        output_tokens=usage.output_tokens if usage is not None else 0,
        latency_ms=latency_ms,
        model=response.model,
        provider="openai",
    )


def _finish(
    request: TaskRequest,
    *,
    text: str,
    tool_call: ToolCall | None,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    model: str,
    provider: Provider,
) -> TaskResult | TaskFailure:
    """Checks shared by both providers, then the result."""
    if request.tool is not None and tool_call is None:
        return TaskFailure(
            "no_tool_call",
            "The model answered in text instead of calling the tool.",
            retryable=True,
        )
    if not text and tool_call is None:
        return TaskFailure("empty", "The model returned no text.", retryable=True)
    return TaskResult(
        text=text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        model=model,
        provider=provider,
        tool_call=tool_call,
    )
```

The matching `tests/test_adapter.py` (eight tests, all passing) covers: Anthropic wins when both keys are set; OpenAI is the fallback; empty values count as unset; `complete` with both keys unset returns `no_api_key` and `retryable=False`; `_finish` returns `no_tool_call` when a tool was given and none came back; `_finish` returns a `TaskResult` carrying the tool call; `_finish` flags empty text; `explain` says "Retryable" only for retryable failures. The fixture is typed `monkeypatch: pytest.MonkeyPatch`.

### 2.5 Behavior notes the READMEs must state

- Both SDKs retry 429 and 5xx twice by default with backoff. A `rate_limit` or `server` failure has already been tried three times. `latency_ms` is wall clock and includes those retries.
- Both SDK clients default to a 10 minute timeout. Pass `timeout=120.0` to both constructors if a lab must stay inside the ten minute budget under a slow network. This is a one-line change in the adapter and was not part of the verified text.
- `output_config={"effort": "low"}` is accepted on Claude Opus 5, Opus 4.8, Opus 4.7, Opus 4.6, Sonnet 5 and Sonnet 4.6. It is rejected on Haiku 4.5, so `LAB_ANTHROPIC_MODEL=claude-haiku-4-5` will fail with `bad_request`. Say so in the README. `reasoning={"effort": "low"}` is accepted on the gpt-5 family and rejected on non-reasoning models such as gpt-4.1.
- `temperature`: never sent to Anthropic. Sent to OpenAI only when set. Whether `gpt-5.6-sol` accepts a non-default value at `effort: low` was not verified; earlier gpt-5 models rejected it unless effort was `none`. The labs leave it `None`. A rejection arrives as a `bad_request` failure, not a stack trace.
- `refusal` is a real stop reason on Opus 5. The skill recommends the server-side `fallbacks` parameter by default for Opus 5 code (`client.beta.messages.create(..., betas=["server-side-fallback-2026-07-01"], fallbacks="default")`). The labs' prompts are support-ticket triage, so the verified adapter maps a refusal to a typed failure instead of adding a beta header. This is a decision for the author (section 5).
- Forced tool use. The Tools lab uses `tool_choice` auto plus a system instruction, not `{"type": "tool", "name": ...}`. Opus 5 accepts forced tool use, Claude Fable 5.1 returns 400 on it. Auto plus `strict: True` keeps the lab portable across the `LAB_ANTHROPIC_MODEL` override, and a text answer instead of a call becomes the `no_tool_call` failure, which is the retry path the spec asks to demonstrate.
- `strict: True` requires `additionalProperties: false` and a `required` list on both providers. The Tools lab's schema has both. Keep the wire schema to types, enums, `required`, `additionalProperties` and descriptions. Length bounds and the email pattern live in Python, which is the lesson of that lab.

### 2.6 Sharing the adapter across three labs

Recommendation: one identical `adapter.py` copied into each lab, with a diff check. Not a uv workspace.

Why copy wins here:

- The spec says each lab is standalone. A learner who copies one directory out of the repo must still be able to run it. A workspace member depends on a root `labs/pyproject.toml` and a single `labs/uv.lock`, so the copy breaks.
- The spec says "provider-specific code lives only in the adapter" and "explicit calls before abstraction". A visible `adapter.py` next to `run.py` is the abstraction the learner is meant to read. A package import hides it.
- `uv init` inside a workspace auto-registers the new directory as a member and shares the lock. Every per-lab `uv sync` would then resolve all three labs. That couples the labs' dependency sets for no benefit.
- The adapter is 230 lines and changes rarely. Drift is cheap to catch.

The diff check, run in CI and before each phase commit:

```sh
#!/usr/bin/env sh
# labs/check_adapter_copies.sh
set -e
canonical="labs/models-first-measurable-feature/adapter.py"
for lab in labs/tools-tool-contract labs/evals-first-grader; do
  diff -q "$canonical" "$lab/adapter.py"
done
echo "adapter copies are identical"
```

The workspace alternative, for the record: `labs/pyproject.toml` with `[tool.uv.workspace] members = ["*"]`, a `labs/lab-adapter/` library member, and in each lab `dependencies = ["lab-adapter"]` plus `[tool.uv.sources] lab-adapter = { workspace = true }`. `uv run --package <lab>` runs one member. Reject it for the reasons above.

### 2.7 Model ids and list prices for the cost statements

| Role | Id | Input $/1M | Output $/1M | Checked |
| --- | --- | --- | --- | --- |
| Anthropic default | `claude-opus-5` | 5.00 | 25.00 | skill table, cached 2026-06-24 |
| Anthropic cheaper override | `claude-sonnet-5` | 2.00 | 10.00 | skill table |
| OpenAI default | `gpt-5.6-sol` | 4.00 | 20.00 | pricing page via ctx7, id confirmed live 2026-09-15 |
| OpenAI cheap override | `gpt-5-mini` | 0.25 | 2.00 | model page via ctx7, id confirmed live 2026-09-15 |

`gpt-5.6-luna` also resolves and the pricing page lists it from $0.20 input. Its output price was not captured. `claude-haiku-4-5` ($1.00 / $5.00) is not usable with this adapter (section 2.5). Put these four rows in each lab's `prices.py` with a `CHECKED_ON = "2026-09-15"` constant, and have `report.py` print "list prices checked on" next to any dollar figure. The spec's artifact rule about checked-on dates applies to prose; carrying it into the labs costs nothing.

## 3. The three labs

Common shape. Each lab is a flat directory of small modules, no package, no `src/`. `run.py` is the entry point. `tests/` holds pytest files that import the modules directly (pytest `pythonpath = ["."]` in `pyproject.toml`). Each README opens with the optional notice, then "what you need" (uv, one API key or none), then the steps. Every lab has the same first two steps: `first_call.py` (raw SDK, one call, prints text and usage), then "the same call through `adapter.complete`". Every `run.py` starts with the same prologue: pick provider, print the plan, print the cost statement, exit 0 with an explanation if there is no key.

Case data is fictional Cedar Support Software material: a small SaaS help desk. Categories are `billing`, `bug`, `how_to`, `feature_request`, `account`, `other`. Nothing is captured from a real product.

### 3.1 labs/models-first-measurable-feature

Purpose. The book's Chapter 3: pick a bounded task, write down what "correct" means, measure a baseline that uses no model, then measure the model against the same cases. The learner leaves with a number, not an impression.

Task. Ticket triage: given one customer message, answer with exactly one category from the six. Output is a single word. That makes the check exact, keeps calls cheap, and makes the baseline honest.

Case set. `cases.json`, 26 items: 4 per category (24) plus 2 deliberately ambiguous ones that accept either of two categories. Each case has `id`, `input`, and either `expected` (one string) or `accept` (a list). That is the "exact-or-rubric" check: `expected` is exact, `accept` is the rubric. Example:

```json
{
  "task": "Assign exactly one category to a Cedar Support ticket.",
  "categories": ["billing", "bug", "how_to", "feature_request", "account", "other"],
  "cases": [
    {"id": "c01", "input": "I was charged twice on the 3rd.", "expected": "billing"},
    {"id": "c05", "input": "CSV export crashes above 500 rows.", "expected": "bug"},
    {"id": "c25", "input": "My card was declined and now I can't log in.", "accept": ["billing", "account"]}
  ]
}
```

File tree.

```
labs/models-first-measurable-feature/
  README.md
  pyproject.toml
  .python-version
  uv.lock
  .gitignore            (.venv, runs/*.jsonl)
  adapter.py            (canonical copy)
  prices.py             (four rows from 2.7, CHECKED_ON)
  first_call.py         (step 1, raw SDK call for whichever key is set)
  cases.py              (load and validate cases.json into Case dataclasses)
  cases.json
  task.py               (build_prompt, normalize, check)
  baseline.py           (keyword rules, no model)
  run.py                (steps 3 to 5: baseline, model run, write runs/<stamp>.jsonl)
  report.py             (read a run file, print the table)
  runs/.gitkeep
  tests/
    test_adapter.py
    test_cases.py
    test_task.py
    test_baseline.py
    test_report.py
```

Flow of `run.py`.

1. Load cases. Refuse to start if any case has neither `expected` nor `accept`, or a category outside the list.
2. Baseline. `baseline.classify(text)` applies a keyword table (for example "charged", "invoice", "refund" mean `billing`). Print baseline accuracy. This is free and instant.
3. Cost statement, printed before the first call: "26 calls. Roughly 200 input and 200 output tokens each (output includes the model's reasoning tokens). About 5,200 input and 5,200 output tokens in total. At list prices checked on 2026-09-15 that is about $0.16 on claude-opus-5 or about $0.12 on gpt-5.6-sol. Order of magnitude: cents. If every answer ran five times longer it would still be under one dollar." The numbers come from `prices.py` and the case count, so the statement stays true when the case set changes.
4. Model run. One `complete()` call per case, sequential, no concurrency. Each result is appended to `runs/<stamp>-<provider>-<model>.jsonl` at once, with `id`, raw text, normalized answer, pass or fail, tokens, latency, model, provider, or the failure kind and message. On a `TaskFailure` print `explain()`. If retryable, stop and print "run again with `--resume`", which reuses the newest run file and skips ids already present. If not retryable, stop and print the cause.
5. Report. `report.py` prints baseline accuracy, model accuracy, per-category correct counts, the ambiguous cases separately, total tokens, total and median latency, estimated cost from actual tokens, and the served model id. `uv run python report.py runs/<file>.jsonl` reprints any run.

`task.py` details. `build_prompt(categories)` returns the system prompt: the category list with one-line definitions and "Answer with the category only." `normalize(text)` lowercases, strips whitespace and trailing punctuation, and keeps the first token. `check(case, answer)` returns `True` when `normalize(answer)` equals `expected` or is in `accept`.

Non-model logic that pytest covers, no key needed: `cases.load` accepts the sample file and rejects a case with no answer or an unknown category; `normalize` handles "Billing.", "  bug\n", "how_to (I think)"; `check` for exact, accept and miss; `baseline.classify` on a few sentences and on an empty string; `report.summarize` on a small in-memory run with two failures and two passes, including the cost arithmetic; the adapter tests from 2.4. All tests run in under a second.

Run instructions (README).

```
cd labs/models-first-measurable-feature
uv sync
uv run pytest -q                      # no key needed
export ANTHROPIC_API_KEY=...          # or OPENAI_API_KEY
uv run python first_call.py           # step 1: one raw call
uv run python run.py --dry-run        # baseline and cost statement only
uv run python run.py                  # full run, writes runs/<stamp>.jsonl
uv run python run.py --limit 5        # a short run
uv run python run.py --resume         # continue after a retryable failure
uv run python report.py runs/<file>.jsonl
```

Time budget. Baseline and tests: seconds. 26 sequential calls at 2 to 6 seconds each: 1 to 3 minutes. Whole lab including reading: under 10 minutes.

### 3.2 labs/tools-tool-contract

Purpose. A tool is a contract: a name, a description the caller reads, a schema the caller must satisfy, and rules the schema cannot express. The lab shows validation catching bad calls from a simulated caller before any model is involved, then asks a real model for one call and validates it the same way.

Tool. `create_ticket` for Cedar Support intake. Fields: `title` (string), `category` (enum of six), `priority` (enum `low`, `normal`, `high`, `urgent`), `customer_email` (string), `body` (string). All five required. `additionalProperties: false`. Two rules outside the schema: title 5 to 120 characters after trimming, and `customer_email` must look like an email. The verified `tool_contract.py` (section 2.4's scratch project) defines `CREATE_TICKET: ToolSpec`, `validate_schema(schema, args) -> list[str]`, `check_rules(args) -> list[str]` and `validate_call(name, args) -> list[str]`. The validator handles non-object arguments, missing required fields, unknown fields, wrong types (with `bool` not counting as `integer`), and enum misses. It is 90 lines and has no dependency.

File tree.

```
labs/tools-tool-contract/
  README.md
  pyproject.toml
  .python-version
  uv.lock
  .gitignore
  adapter.py            (identical copy)
  prices.py
  first_call.py
  tool_contract.py      (schema, rules, validators)
  simulated_caller.py   (a caller that only reads the description)
  malformed_calls.json  (10 bad calls with the reason each is bad)
  messages.json         (6 customer messages for the simulated and live steps)
  run.py
  tests/
    test_adapter.py
    test_tool_contract.py
    test_simulated_caller.py
    test_malformed_calls.py
```

Flow of `run.py`.

1. Print the contract: the description, the schema as JSON, and the two extra rules.
2. Simulated caller. `SimulatedCaller(tool)` reads `tool.description` and `tool.input_schema` and builds a `ToolCall` from a message with fixed heuristics: title is the first sentence cut to 120 characters, category from a keyword table, priority from words like "urgent" or "down", email by regex, body unchanged. Run it on `messages.json`, validate each call, print the call and "valid" or the error list. One message has no email address, so the simulated caller produces an invalid call and the learner sees the validator catch it.
3. Malformed calls. Load `malformed_calls.json`. Each entry has `id`, `why`, `call` (`name` and `arguments`) and `expect_errors` (substrings). The ten cover: missing required field, unknown field, wrong type for title, wrong type for priority, enum miss on category, enum miss on priority, arguments that are a list not an object, wrong tool name, title too short, invalid email. Print each with the validator's output. This step is free.
4. Cost statement: "One call. About 400 input and 300 output tokens. Under one cent on either provider at list prices checked on 2026-09-15." Stop here with `--dry-run` or with no key.
5. Live call. `complete(TaskRequest(system=INTAKE_PROMPT, user=message, tool=CREATE_TICKET))` where the prompt says "Read the customer message and call create_ticket exactly once. Do not answer in prose." On `TaskResult`, run `validate_call(result.tool_call.name, result.tool_call.arguments)` and print PASS with the arguments, tokens and latency, or FAIL with the errors. On `TaskFailure`, print `explain()`. A `no_tool_call` is retryable and the message says to run again. With `strict: True` the schema part should always pass; the rules part is where a real failure can appear, and that is the point.

Non-model logic that pytest covers: the seven `test_tool_contract.py` tests from the scratch project (good call passes, missing required, unknown field, wrong type and bad enum, non-object arguments, rules beyond the schema, unknown tool name); `test_simulated_caller.py` on two messages, one valid and one without an email; `test_malformed_calls.py` loads the JSON and asserts every `expect_errors` substring appears in the validator's output for that entry, which keeps the fixture and the validator honest together; the adapter tests.

Run instructions.

```
cd labs/tools-tool-contract
uv sync
uv run pytest -q
uv run python run.py --dry-run        # steps 1 to 4, no key needed
export ANTHROPIC_API_KEY=...          # or OPENAI_API_KEY
uv run python run.py                  # adds the one live call
```

Time budget. Steps 1 to 4 are instant. The live call is one request. Whole lab: under 5 minutes.

### 3.3 labs/evals-first-grader

Purpose. Look at outputs before you write a grader. Label 30 replies by hand, write the simplest grader that could work, measure how often it agrees with you, and read the disagreements. The learner leaves knowing that a grader is a hypothesis about quality, and that agreement with a human is how you test it.

Task under review. A support reply drafter. A reply passes when it (1) names the customer's specific problem, (2) gives exactly one concrete next step, (3) promises no refund, credit or delivery date, and (4) is under 120 words. These four rules are printed in the review loop and are the grader's spec.

Provided outputs. `outputs.jsonl`, 30 items, each `{"id", "ticket", "reply"}`. Written for the lab with a planned mix: about 18 that pass, about 12 that fail, spread over the four rules, including 3 or 4 borderline cases (a vague acknowledgement, two next steps, a "we will look into it" that is not a step). The README says the replies are synthetic.

File tree.

```
labs/evals-first-grader/
  README.md
  pyproject.toml
  .python-version
  uv.lock
  .gitignore            (.venv, labels.jsonl)
  adapter.py            (identical copy)
  prices.py
  first_call.py
  outputs.jsonl
  records.py            (load outputs, read and append labels, resume)
  review.py             (the hand review loop)
  grader.py             (the first grader: four rules as functions)
  agreement.py          (accuracy, Cohen's kappa, confusion counts, disagreements)
  model_grader.py       (optional LLM grader through the adapter)
  run.py
  tests/
    test_adapter.py
    test_records.py
    test_grader.py
    test_agreement.py
    test_model_grader.py  (parsing only)
```

Flow.

1. `uv run python review.py`. For each unlabelled item: print the ticket, the reply, the four rules, and a prompt. Keys: `p` pass, `f` fail, `s` skip, `q` quit. Optional one-line note after `p` or `f`. Append `{"id", "label", "note", "reviewed_at"}` to `labels.jsonl` at once, so quitting loses nothing and the next run resumes. The loop takes an `input_fn` and an `output_fn` so tests can drive it. About 10 seconds per item, 5 minutes for 30.
2. `uv run python run.py`. Load outputs and labels. Run `grader.grade(reply) -> Verdict(passed, reasons)` on every item. Print hand pass count, grader pass count, accuracy, kappa, a two-by-two table, and every disagreement with the learner's note beside the grader's reasons. If fewer than 20 items are labelled, say so and still print what it can. No model, no cost.
3. `uv run python run.py --model`. Cost statement first: "30 calls, about 600 input and 200 output tokens each, about 18,000 input and 6,000 output tokens. About $0.24 on claude-opus-5 or about $0.19 on gpt-5.6-sol at list prices checked on 2026-09-15. Order of magnitude: cents, under one dollar." Then `model_grader.grade(ticket, reply)` calls `complete()` with the four rules in the system prompt and "Answer PASS or FAIL on the first line, one reason on the second." `parse_verdict(text)` is strict about the first line. Print the same agreement table for the model grader, then a three-way view: items where the rule grader and the model grader disagree with each other. Failures print `explain()`; retryable ones say to run again, and results already collected are kept in `model_labels.jsonl`.

`grader.py` details. Four functions, each `(ticket: str, reply: str) -> str | None` returning a reason on failure: `acknowledges` (shares at least one content noun with the ticket, or uses an acknowledgement phrase), `one_next_step` (counts imperative or "you can" or "please" sentences and wants exactly one), `no_promises` (regex over refund, credit, reimburse, "by <weekday or date>", "within <n> days"), `short_enough` (word count under 120). `grade` runs all four and collects reasons. It is deliberately crude. The lesson lands in the disagreement list.

`agreement.py` is the verified module from the scratch project: `measure(hand, grader) -> Agreement` with `accuracy`, `kappa`, four confusion counts and the `disagreements` tuple, comparing only ids both sides labelled and safe on empty input.

Non-model logic that pytest covers: `records` loading, appending and resume (a temp file with two labels skips those ids); the review loop with a scripted `input_fn` (`p`, note, `f`, `q`) writes the expected records and stops; each grader rule on two or three fixture replies, plus `grade` on one that fails two rules; the four `test_agreement.py` tests from the scratch project (perfect agreement, partial agreement with kappa 0.5, shared ids only, empty input); `parse_verdict` on "PASS", "FAIL\nreason", lowercase, and junk; the adapter tests.

Run instructions.

```
cd labs/evals-first-grader
uv sync
uv run pytest -q
uv run python review.py               # label by hand, resumable, no key
uv run python run.py                  # rule grader vs your labels, no key
export ANTHROPIC_API_KEY=...          # or OPENAI_API_KEY
uv run python run.py --model          # adds the model grader, 30 calls
```

Time budget. Review 5 minutes. Rule grader instant. Model grader 1 to 3 minutes. Whole lab: under 10 minutes if the learner does the review in one sitting.

## 4. pyproject.toml, ruff settings, uv commands

### 4.1 pyproject.toml template (verified in the scratch project)

Change `name` and `description` per lab. Everything else is identical across the three.

```toml
[project]
name = "models-first-measurable-feature"
version = "0.1.0"
description = "Optional lab for the Models module: the first measurable feature"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "anthropic>=1.6.0",
    "openai>=3.14.1",
]

[dependency-groups]
dev = [
    "pytest>=9.1.1",
    "ruff>=0.16.7",
]

[tool.ruff]
line-length = 88

[tool.ruff.lint]
select = ["E", "W", "F", "I", "UP", "B", "ANN", "SIM", "C4", "PT", "RUF"]

[tool.ruff.format]
docstring-code-format = true

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

Why these ruff settings.

- `line-length = 88` is the default. Stating it makes the number visible to learners. `E501` enforces it and `ruff format` wraps to it, so `ruff format` then `ruff check` is the order.
- No `target-version`. Ruff reads `requires-python = ">=3.12"` and the docs recommend that over a duplicate setting. `UP` then upgrades syntax to 3.12 idioms, so `X | Y` unions and `list[str]` are expected and `from __future__ import annotations` is not needed.
- `select` replaces the default set (a subset of `E` and `F`). `E`, `W`, `F` are pycodestyle and Pyflakes. `I` sorts imports; local modules at the lab root are detected as first party without configuration. `UP` is pyupgrade. `B` is bugbear. `ANN` is the "type hints on all functions" requirement; `ANN401` bans `Any`, so the code uses `object`. `SIM`, `C4`, `RUF` are small quality rules. `PT` enforces pytest style in `tests/`.
- No `per-file-ignores`. Tests carry annotations too: `-> None`, `monkeypatch: pytest.MonkeyPatch`, `tmp_path: pathlib.Path`, `capsys: pytest.CaptureFixture[str]`.
- `docstring-code-format = true` formats code examples inside docstrings. Default is false.
- Formatter defaults are kept: double quotes, four spaces, `line-ending = "auto"`.
- `pythonpath = ["."]` lets `tests/test_task.py` write `from task import check` with no package and no `conftest.py`. `testpaths` keeps `uv run pytest` from collecting anything else.

The lock file `uv.lock` is committed per lab. `.gitignore` from `uv init` already excludes `.venv`; add `runs/*.jsonl` or `labels.jsonl` per lab.

### 4.2 uv commands

Create a lab (run once per lab, from the repo root).

```
mkdir -p labs
cd labs
uv init --app --python 3.12 --no-workspace --vcs none models-first-measurable-feature
cd models-first-measurable-feature
rm main.py
uv add anthropic openai
uv add --dev pytest ruff
uv sync
```

What each flag does, verified on uv 0.11.7: `--app` creates an application project with no build system and no package (the labs are scripts, not importable distributions). `--python 3.12` writes `.python-version` containing `3.12` and `requires-python = ">=3.12"`. `--no-workspace` stops uv from attaching the directory to any parent workspace. `--vcs none` skips `git init` inside the existing repository. `uv add` writes `dependencies` with `>=` pins and `uv add --dev` writes `[dependency-groups] dev`. `uv sync` creates `.venv` with the uv-managed CPython 3.12.13 and installs the dev group by default. Replace the generated `pyproject.toml` blocks with the template in 4.1 after `uv add`, or paste the template first and run `uv sync`; both produce the same lock.

Day to day, inside a lab directory.

```
uv sync                      # create or update .venv from uv.lock
uv run ruff format .         # format
uv run ruff check .          # lint; add --fix for safe autofixes
uv run ruff format --check . # CI form
uv run pytest -q             # tests, no key needed
uv run python run.py         # the lab
uv lock                      # refresh uv.lock after editing dependencies
uv sync --locked             # CI form: fail if uv.lock is stale
uv python pin 3.12           # rewrite .python-version if it drifts
```

`uv run` checks the lock and syncs the environment before every invocation, so `uv run pytest` after a fresh clone needs no separate install step. `uv run --frozen` skips that check when speed matters. `uvx ruff@0.16.7 check .` also works without a project, which is handy for the copy-check script, but the labs pin ruff in the dev group so the version is fixed per lab.

CI sketch (optional, one job): for each `labs/*/`, run `uv sync --locked`, `uv run ruff format --check .`, `uv run ruff check .`, `uv run pytest -q`; then run `labs/check_adapter_copies.sh`. No API key in CI. The live steps are never run in CI.

Commit plan, per the "commit per phase" decision: one commit that adds `labs/models-first-measurable-feature` (adapter canonical copy, tests, README), one for `labs/tools-tool-contract`, one for `labs/evals-first-grader` plus the copy-check script. Each commit has `ruff check`, `ruff format --check` and `pytest` clean.

## 5. Decisions this forces, and open questions

Decisions forced by verification.

1. The OpenAI default id is `gpt-5.6-sol`, not `gpt-5.6`. The guides print `gpt-5.6`; the live models endpoint says it does not exist. `LAB_OPENAI_MODEL` is the override.
2. `TaskRequest.temperature` is optional and is never sent to Anthropic. The installed SDK has no such parameter and current Claude models reject it.
3. The adapter carries two optional tool fields. The Tools lab cannot otherwise produce "one real model call that must produce a valid tool call" through a single function with provider code only in the adapter.
4. Default `max_tokens` is 4096 because thinking and reasoning tokens count toward the cap on both defaults.
5. `output_config.effort` and `reasoning.effort` are `low` in the adapter. That keeps calls short and cheap for one-word answers. Overrides to Haiku 4.5 or gpt-4.1 will fail with `bad_request`, and the READMEs say so.
6. Copy the adapter per lab; no workspace; a diff script guards drift.

Open questions for the author.

1. Refusal fallbacks. The skill's default for Opus 5 code is the server-side `fallbacks="default"` beta. The verified adapter maps refusal to a typed failure instead. Keep it simple, or add the beta header?
2. Should the Anthropic default be `claude-opus-5` (skill default, $5/$25) or `claude-sonnet-5` ($2/$10) for a teaching lab? The cost statements are cents either way. The skill says not to downgrade without the user's decision, so Opus 5 stands unless the author picks Sonnet.
3. `temperature` on `gpt-5.6-sol` at `effort: low` was not verified. The labs never set it. Should the field stay at all, or be dropped to match what both providers accept?
4. A live smoke run of all three labs was not performed here (no paid calls were made). A `ANTHROPIC_API_KEY` was not available; an `OPENAI_API_KEY` was present in the shell and was used only for the free models endpoint. The author should run each lab once on each provider before the phase commit.
5. The Chapter 3 task. The spec names "the first measurable feature" without content. This design chooses ticket triage. If the book's chapter later specifies a different feature, `cases.json` and `task.py` change and nothing else does.
6. Should the copy-check script and a labs CI job live in this phase, or wait until the site's CI exists?

