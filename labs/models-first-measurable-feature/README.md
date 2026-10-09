# First measurable feature

This lab is optional and does not count toward module completion.

It goes with the Models module of Becoming an AI Engineer and the book's Chapter 3. It is a small Python project, standalone, with no dependency on the site.

## What this lab teaches

Pick a bounded task. Write down what correct means. Measure a baseline that uses no model. Then measure a model on the same cases, with the same check. You leave with a number, not an impression.

The task is ticket triage. Each ticket gets exactly one label from a fixed set: `billing`, `bug`, `how_to`, `feature_request`, `account`, `other`. The cases are 24 synthetic tickets for Cedar Support, a fictional help desk product. No ticket comes from a real customer. 22 cases have one expected label. 2 are ambiguous on purpose and accept either of two labels.

What `run.py` does, in five parts. It prints each part's name as it goes.

- Part 1. Runs a keyword rules baseline on every case. No model, no cost.
- Part 2. Prints the plan: the number of calls and a cost estimate in dollars, before any paid call.
- Part 3. Makes one explicit model call per case through the adapter, one at a time. Each answer goes through the output contract: one label from the set, or rejected. A rejected answer is never guessed into a label. It counts as wrong.
- Part 4. Prints a report for the baseline and the model on the same cases: accuracy, a confusion matrix, per-label precision and recall, the ambiguous cases on their own, tokens, latency, the cost from actual tokens, and the served model id.
- Part 5. Writes a selection note next to the run file, with the measured numbers filled in. You write the decision at the end.

## What you need

- The lab files. They live in the site's public repository. Clone it and change into this lab:

  ```sh
  git clone https://github.com/sequenzia/becoming-an-aie.git
  cd becoming-an-aie/labs/models-first-measurable-feature
  ```

  The directory is standalone. Copy it out of the repository and it still runs.
- uv, checked with uv 0.11.7 on 2026-10-09. On macOS or Linux, install it with `curl -LsSf https://astral.sh/uv/install.sh | sh`. On Windows, use `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`. uv fetches Python 3.12 for you.
- One API key, or none. With no key, everything except the model run works, and the lab tells you what it would have done.

## Explicit calls first

The lab follows the book's order: the raw call, then the abstraction.

Step 1. `first_call.py`. One raw call with the provider's own SDK, for whichever key is set. Read it first. It prints the cost of the call before it makes it. It shows the request, the response's content blocks, the served model id, and the token usage. Nothing is hidden.

Step 2. `adapter.py`. The same call, wrapped once. `complete(TaskRequest) -> TaskResult | TaskFailure` takes a request and returns text, usage, timing, and model identity, or a typed failure. It never raises: every SDK error comes back as a typed failure. Provider-specific code lives only here and in `first_call.py`. The Tools and Evals labs carry a byte-for-byte copy of this file. This copy is the canonical one.

Step 3. The lab. `run.py` only calls `adapter.complete`. It does not import a provider SDK. Its five parts are listed above.

## Setup

From the lab directory:

```sh
uv sync
export ANTHROPIC_API_KEY=...   # or OPENAI_API_KEY
```

| Variable | What it does |
| --- | --- |
| `ANTHROPIC_API_KEY` | Uses Anthropic. Wins when both keys are set. |
| `OPENAI_API_KEY` | Uses OpenAI when no Anthropic key is set. |
| `LAB_ANTHROPIC_MODEL` | Overrides the Anthropic model. Default `claude-opus-5-5`. |
| `LAB_OPENAI_MODEL` | Overrides the OpenAI model. Default `gpt-5.6-sol`. |

An empty value counts as unset, for the keys and for the model variables.

## Run it

```sh
uv run python first_call.py                # step 1: one raw call
uv run python run.py --dry-run             # baseline, plan, cost estimate, no call
uv run python run.py                       # the full run, 24 calls
uv run python run.py --limit 5             # at most 5 calls this time
uv run python run.py --resume              # continue the newest run for this model
uv run python report.py runs/<file>.jsonl  # reprint a run, refresh its note
```

Each answer is written to `runs/<stamp>-<provider>-<model>.jsonl` as soon as it returns. That file is the progress file. `--resume` finds the newest run file for the same provider and model and skips every case that already has an answer, so a failure halfway costs nothing that was already paid for. The selection note is written next to it as `<run file name>-selection.md`. Both are ignored by git.

A later `--resume` or `report.py` refreshes the note with the new numbers, until you write your decision in its Decision section. From then on the note is kept as it is, and the lab says so. Delete the note to have it written again.

With no key, `run.py` prints the baseline, the plan, and the cost estimate for both default models, says which variable to set, points you to `first_call.py` as the first call to make, and exits 0. `--dry-run` ends with the same pointer.

Time. The baseline and the tests take seconds. 24 sequential calls at 2 to 6 seconds each take 1 to 3 minutes. The whole lab, with reading, fits in ten minutes.

## Cost

`run.py` computes the estimate from the case count, the prompt length, and `prices.py`, and prints it before the first call. On the full case set it says:

- 24 calls. About 3,900 input tokens in total, roughly 160 per call, and 4,800 output tokens, 200 per call. Output includes the model's reasoning tokens.
- On `claude-opus-5-5` at $4.00 input and $20.00 output per million tokens, list price checked on 2026-10-09: about $0.11.
- On `gpt-5.6-sol` at $4.00 input and $20.00 output per million tokens, list price as of 2026-09-15: about $0.11.
- Order of magnitude: cents, under one dollar. If every answer ran five times longer, it would still be under one dollar.

`first_call.py` is one call: under one cent at list prices checked on 2026-10-09. It prints that line, with the model id and the price date, before it calls.

Where the prices come from. Anthropic rows come from the claude-api skill's model table, cached 2026-10-06 and checked on 2026-10-09. OpenAI rows come from the OpenAI pricing page as read on 2026-09-15. They were not re-checked, because the models endpoint that would confirm them needs a key. The report prints the list-price date next to every dollar figure. Prices change. Check the provider's pricing page before you trust a figure.

## Tests

```sh
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

The tests need no key and make no network call. They cover the adapter's no-key path (the typed `no_api_key` failure), provider selection, the shared result checks, malformed tool arguments and other SDK errors as typed failures through a stand-in client, empty model variables, case loading and its refusals, the output contract, the rules baseline, the confusion matrix and precision and recall, the price lookup and cost arithmetic, the run file, the report and the selection note, including a note with a written decision surviving a second write, `first_call.py` with no key, its cost line printed before the call, and its retry advice on an error, and `run.py` end to end with a scripted stand-in for `adapter.complete`: no key, `--dry-run`, a full run, `--limit`, a retryable failure, `--resume`, and a permanent failure.

## Files

| File | What it holds |
| --- | --- |
| `first_call.py` | Step 1. One raw SDK call per provider. |
| `adapter.py` | Step 2. The thin adapter. Canonical copy. |
| `data/cases.json` | The 24 synthetic cases and the label set. |
| `cases.py` | Loads the cases. Refuses a case with no answer or an unknown label. |
| `task.py` | The prompt, the output contract, and the check. |
| `baseline.py` | The keyword rules. No model. |
| `metrics.py` | Confusion matrix, precision, recall. |
| `prices.py` | List prices with their dates, and the cost arithmetic. |
| `runlog.py` | The run file, which is also the progress file. |
| `report.py` | The report and the selection note. |
| `run.py` | The lab. |

## Behavior notes

- Retries. Both SDKs retry 429 and 5xx twice by default, with backoff. A `rate_limit` or `server` failure has already been tried three times. `latency_ms` is wall clock and includes those retries.
- Timeouts. Both SDK clients default to a 10 minute read timeout. If a slow network threatens the ten minute budget, pass `timeout=120.0` to both client constructors in `adapter.py`. That is a one-line change, and it is not part of the verified adapter. This is the canonical copy. After any edit, copy it to the Tools and Evals labs and run `labs/check_adapter_copies.sh` from the repository to confirm the three copies are identical.
- Effort. The adapter sends `output_config={"effort": "low"}` to Anthropic and `reasoning={"effort": "low"}` to OpenAI. Low effort keeps one-word answers short and cheap. Claude Opus 5, Opus 5.5, Opus 4.8, Opus 4.7, Opus 4.6, Sonnet 5 and Sonnet 4.6 accept it. Claude Haiku 4.5 rejects it, so `LAB_ANTHROPIC_MODEL=claude-haiku-4-5` fails with `bad_request`. The gpt-5 family accepts `reasoning.effort`. Non-reasoning models such as gpt-4.1 reject it.
- Temperature. Never sent to Anthropic. anthropic 1.13.0 has no such parameter, and Claude Opus 5, Opus 5.5 and Fable 5 return 400 if it is sent. Sent to OpenAI only when a request sets it. This lab never sets it. A rejection arrives as a `bad_request` failure, not a stack trace.
- Refusals. `refusal` is a real stop reason on current Claude models. The adapter maps it to a typed `refusal` failure. It does not use the server-side `fallbacks` beta that the claude-api skill recommends by default for Opus 5 and Opus 5.5 code. Support-ticket triage should not trigger it.
- Tool calls. This lab sends no tool. The adapter's tool fields serve the Tools lab, which uses `tool_choice` auto with `strict: true`. Forced tool use returns 400 on Claude Fable 5.1, Opus 5.5 and Sonnet 5.5, so auto keeps the override portable.
- Thinking tokens. On `claude-opus-5-5` thinking is always on and counts toward `max_tokens` and `output_tokens`. On the gpt-5 family reasoning tokens count toward `max_output_tokens` and `output_tokens`. That is why the default `max_tokens` is 4096 and why the cost estimate allows 200 output tokens for a one-word answer.
- Model choice. The default Anthropic model is Claude Opus 5.5, `claude-opus-5-5`, at $4.00 input and $20.00 output per million tokens, list price checked on 2026-10-09. It is the default model in the claude-api skill, whose model table was cached on 2026-10-06. It accepts `effort: low`. The adapter sends no temperature and never disables thinking, which Opus 5.5 rejects. Claude Opus 5, `claude-opus-5`, was the default before. It keeps its row in `prices.py`, so `LAB_ANTHROPIC_MODEL=claude-opus-5` still gets a cost estimate.
- Served model id. The report prints the id the provider says it served. A dated snapshot id, such as `gpt-5.6-sol-2026-08-01`, is priced as its base id. An id with no row in `prices.py` gets no dollar figure.

## Versions, and where this lab departs from the design

The design is `docs/research/labs.md` in the site repository, verified on 2026-09-15 against anthropic 1.6.0 and openai 3.14.1.

Pinned on 2026-10-09, as uv resolved them: anthropic 1.13.0, openai 3.27.0, pytest 9.1.1, ruff 0.16.10, Python 3.12.13. Every call signature, parameter, error class and response field the adapter uses was confirmed by introspecting these versions, and the adapter was run against a local fake server for every failure kind. No paid call was made.

Corrections to the adapter in labs.md section 2.4:

- The docstring's version line now names anthropic 1.13.0 and openai 3.27.0, checked on 2026-10-09, and keeps the original 2026-09-15 versions. Nothing in today's packages required a code change. The three changes below came from a review on 2026-10-09.
- On OpenAI, function-call arguments that are not valid JSON return a typed `no_tool_call` failure, marked retryable. The verified text let `json.loads` raise.
- Any other SDK error, such as a response the SDK cannot validate, returns a typed `bad_request` failure that is not retryable. The verified text caught only status and connection errors.
- An empty `LAB_ANTHROPIC_MODEL` or `LAB_OPENAI_MODEL` counts as unset and the default model is used. The verified text would have sent an empty model id.

Other departures from labs.md section 3.1:

- The case set is 24 cases, not 26: 22 single-label cases and 2 ambiguous ones. 24 sequential calls keep the run inside the ten minute budget.
- The cases live in `data/cases.json`, not at the lab root.
- The output contract is explicit. `task.validate` returns the label or a `Rejected` with a reason. `task.check` takes the validated answer. Rejections get their own column in the confusion matrix.
- Two modules were added. `metrics.py` holds the confusion matrix and per-label precision and recall. `runlog.py` holds the run file, which is also the progress file for `--resume`.
- The report writes a selection note next to the run file, and keeps it once you have written your decision in it.
- `--limit N` means at most N model calls in this invocation, so it also works with `--resume`.
- The default Anthropic model is `claude-opus-5-5`, not `claude-opus-5`. Claude Opus 5.5 is now the default in the claude-api skill, at a lower list price.
- `prices.py` has rows for `claude-opus-5-5`, `claude-sonnet-5-5` and `gpt-5.5` besides the four in labs.md. The `claude-opus-5` row stays, so that override still gets a dollar figure.
- `pyproject.toml` pins exact versions with `==`, so every learner gets the versions the lab was checked with. labs.md section 4.1 used `>=`.
- ruff is pinned at 0.16.10. labs.md section 4.1 named 0.16.7.
