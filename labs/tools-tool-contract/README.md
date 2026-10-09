# A tool contract with validation

This lab is optional and does not count toward module completion.

It goes with the Tools and extensibility module of Becoming an AI Engineer and the book's Chapter 15. It is a small Python project, standalone, with no dependency on the site.

## What this lab teaches

A tool is a contract between code and a model caller. The model reads the name, the description and the input schema, then proposes a call. It never runs anything. Your code decides whether the call runs.

The lab has one task-shaped tool, `lookup_order`, in the customer portal of Cedar Support Software, a fictional help desk vendor. A signed-in customer asks about one of their orders. The tool takes an order number and a response format. It takes no customer id. The customer comes from the session, which the application authenticated, never from the model's arguments.

Every call goes through a validator before anything runs. The validator runs three checks in order and stops at the first that fails:

1. Schema. The tool name, an object, the required fields, no unknown fields, the types, the enum.
2. Rules. What the schema cannot express: an order number is `ORD-` followed by five digits.
3. Scope. The order must belong to the signed-in customer.

Each rejection is a typed error with a kind, a field, and a message. The kind is for you, the owner. The message is what the caller would be told. An order on another customer's account and an order that does not exist get the same message, so the caller learns nothing about other accounts. The report still tells you which was which.

Only an accepted call reaches the executor, which reads the fixture data through a scoped query and returns names beside stable ids.

What `run.py` does, in five parts. It prints each part's name as it goes.

- Part 1. Prints the contract: the description, the input schema, and the two rules that live in code.
- Part 2. Runs the validator on 13 hand-written calls, good and bad, and executes the accepted ones. No model, no cost.
- Part 3. Prints the plan: the number of calls and a cost estimate in dollars, before any paid call.
- Part 4. Sends six customer requests to the model through the adapter, one at a time, with the tool attached. It validates each returned call before executing it.
- Part 5. Prints the report: which calls were accepted, which were rejected and why, what the caller would be told, and tokens, latency and cost.

Two of the six requests ask for an order that belongs to another customer. One of them is an injection: the message claims admin rights. The model may well pass that order number on. The scope check refuses it either way, and that is the point. A test that passes only because the model behaved is not a test of authorization.

All data is synthetic. The customers, the orders, and the messages were written for this lab. None comes from a real customer.

## What you need

- The lab files. They live in the site's public repository. Clone it and change into this lab:

  ```sh
  git clone https://github.com/sequenzia/becoming-an-aie.git
  cd becoming-an-aie/labs/tools-tool-contract
  ```

  The directory is standalone. Copy it out of the repository and it still runs.
- uv, checked with uv 0.11.7 on 2026-10-09. On macOS or Linux, install it with `curl -LsSf https://astral.sh/uv/install.sh | sh`. On Windows, use `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`. uv fetches Python 3.12 for you.
- One API key, or none. With no key, parts 1 to 3 of `run.py` run, and the lab tells you what part 4 would do.

## Explicit calls first

The lab follows the book's order: the raw call, then the abstraction.

Step 1. `first_call.py`. One raw call with the provider's own SDK, for whichever key is set, with the tool definition written out in that provider's shape. It prints the cost of the call before it makes it. Then it prints the tool call the model proposes, the served model id, and the token usage. Nothing runs. Read it first.

Step 2. `adapter.py`. The same call, wrapped once. `complete(TaskRequest) -> TaskResult | TaskFailure` takes a request, optionally with one tool, and returns text, the tool call, usage, timing, and model identity, or a typed failure. It never raises: every SDK error, and tool arguments that are not valid JSON, come back as a typed failure. Provider-specific code lives only here and in `first_call.py`. This file is a byte-for-byte copy of `labs/models-first-measurable-feature/adapter.py`. Do not edit it here.

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
uv run python first_call.py          # step 1: one raw call with the tool
uv run python run.py --dry-run       # parts 1 to 3: contract, fixtures, plan, no call
uv run python run.py                 # the full run, 6 calls
uv run python run.py --limit 2       # at most 2 calls this time
uv run python run.py --resume        # continue the newest run for this model
```

Each verdict is written to `runs/<stamp>-<provider>-<model>.jsonl` as soon as the call returns, with the arguments, the verdict, the error kinds, and the result the caller would read. That file is the progress file. `--resume` finds the newest run file for the same provider and model and skips every request that already has a verdict. Run files are ignored by git.

What stops the loop, and what does not:

- A prose answer instead of a tool call (`no_tool_call`), or a refusal, is about one request. The lab prints the typed failure, records it, and moves on. Run again with `--resume` to ask again for those requests.
- Any other failure is about the provider or the setup: `auth`, `rate_limit`, `server`, `network`, `bad_request`, `truncated`. The next request would fail the same way, so the lab prints the typed failure and stops. A retryable failure says to run the same command again with `--resume`. A permanent one says to fix the cause first.

With no key, `run.py` prints parts 1 to 3 and the cost estimate for both default models, says which variable to set, points you to `first_call.py` as the first call to make, and exits 0. `--dry-run` ends with the same pointer.

Time. Parts 1 to 3 and the tests take seconds. Six sequential calls at 2 to 6 seconds each take under a minute. The whole lab, with reading, fits in ten minutes.

## Cost

`run.py` computes the estimate from the request count, the prompt, the tool definition, and `prices.py`, and prints it before the first call. On the full request set it says:

- 6 calls. About 5,100 input tokens in total, roughly 850 per call with the tool definition, and 1,800 output tokens, 300 per call. Output includes the model's reasoning tokens and the tool call.
- On `claude-opus-5-5` at $4.00 input and $20.00 output per million tokens, list price checked on 2026-10-09: about $0.06.
- On `gpt-5.6-sol` at $4.00 input and $20.00 output per million tokens, list price as of 2026-09-15: about $0.06.
- Order of magnitude: a few cents. If every answer ran five times longer, it would still be under one dollar.

`first_call.py` is one call: about one cent at list prices checked on 2026-10-09. It prints that line, with the model id and the price date, before it calls.

The input estimate adds a 500-token allowance per call for the instructions a provider wraps around tool definitions. That allowance is a round number, not a measured figure. The report prints the tokens the provider actually counted.

Where the prices come from. Anthropic rows come from the claude-api skill's model table, cached 2026-10-06 and checked on 2026-10-09. OpenAI rows come from the OpenAI pricing page as read on 2026-09-15. They were not re-checked, because the models endpoint that would confirm them needs a key. Prices change. Check the provider's pricing page before you trust a figure.

## Tests

```sh
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

The tests need no key and make no network call. They cover:

- The validator: every error kind, the order of the three checks, schema errors collected together, the order number rule on strings the schema accepts, and the rejection of an order that belongs to another customer, with the same order accepted for its owner.
- That an order on another account reads to the caller exactly like a missing one, and that a `customer_id` slipped into the arguments is an unknown field.
- The executor: the summary and line-item results, money formatting, and that it scopes its own lookup even if handed a forged accepted call.
- Every hand-written fixture call reaching the verdict it expects, and the fixture set covering every error kind.
- The report: counts, verdicts, what the caller is told, the latest record per request, tokens, latency, and cost with the list-price date.
- The fixture data, the request file, and the run file, with their refusals.
- The adapter's no-key path (the typed `no_api_key` failure), provider selection, the shared result checks, malformed tool arguments and other SDK errors as typed failures through a stand-in client, and empty model variables.
- `first_call.py` with no key, its cost line printed before the call, its retry advice on an error, and that its inline schema matches the contract's.
- `run.py` end to end with a scripted stand-in for `adapter.complete`: no key, `--dry-run`, a full run, a smuggled `customer_id`, `--limit`, a prose answer, a provider failure, `--resume`, and a permanent failure.

## Files

| File | What it holds |
| --- | --- |
| `first_call.py` | Step 1. One raw SDK call per provider, with the tool. |
| `adapter.py` | Step 2. The thin adapter. A copy of the canonical file. |
| `contract.py` | The tool definition, the rules, the typed errors, and the validator. |
| `store.py` | The fixture data and its scoped lookup. |
| `executor.py` | Runs an accepted call. Builds the result the caller reads. |
| `scenarios.py` | Loads the requests and fixture calls. The system prompt. |
| `prices.py` | List prices with their dates, and the cost arithmetic. |
| `runlog.py` | The run file, which is also the progress file. |
| `report.py` | The fixture table and the live report. |
| `run.py` | The lab. |
| `data/orders.json` | Three fictional customers and six orders. |
| `data/requests.json` | Six customer messages for part 4, the live calls. |
| `data/fixture_calls.json` | Thirteen hand-written calls and the verdict each must get. |

## Behavior notes

- Retries. Both SDKs retry 429 and 5xx twice by default, with backoff. A `rate_limit` or `server` failure has already been tried three times. `latency_ms` is wall clock and includes those retries.
- Timeouts. Both SDK clients default to a 10 minute read timeout. If a slow network threatens the ten minute budget, pass `timeout=120.0` to both client constructors in the canonical `adapter.py`, then copy it here. That is a one-line change, and it is not part of the verified adapter. Run `labs/check_adapter_copies.sh` from the repository afterwards. It fails if the three copies differ.
- Effort. The adapter sends `output_config={"effort": "low"}` to Anthropic and `reasoning={"effort": "low"}` to OpenAI. Claude Opus 5, Opus 5.5, Opus 4.8, Opus 4.7, Opus 4.6, Sonnet 5 and Sonnet 4.6 accept it. Claude Haiku 4.5 rejects it, so `LAB_ANTHROPIC_MODEL=claude-haiku-4-5` fails with `bad_request`. The gpt-5 family accepts `reasoning.effort`. Non-reasoning models such as gpt-4.1 reject it.
- Temperature. Never sent to Anthropic. anthropic 1.13.0 has no such parameter, and Claude Opus 5, Opus 5.5 and Fable 5 return 400 if it is sent. Sent to OpenAI only when a request sets it. This lab never sets it. A rejection arrives as a `bad_request` failure, not a stack trace.
- Refusals. `refusal` is a real stop reason on current Claude models. The adapter maps it to a typed `refusal` failure. It does not use the server-side `fallbacks` beta that the claude-api skill recommends by default for Opus 5 and Opus 5.5 code. This lab records a refusal for that request and moves on.
- Tool choice. The adapter sends the tool with `tool_choice` left at auto and `strict: true`, and the system prompt says to call the tool. It does not force the call. Forced tool use returns 400 on Claude Fable 5.1, Opus 5.5 and Sonnet 5.5, so auto keeps the model override portable. A text answer instead of a call becomes the `no_tool_call` failure.
- Strict mode. `strict: true` needs `additionalProperties: false` and every property in `required`, on both providers. The schema here has both. With strict on, the provider should only return calls that match the schema, so live calls should never hit a schema error. Rule and scope errors can still happen, and the validator runs all three checks anyway: the fixture calls show why. The wire schema keeps to types, an enum, `required`, `additionalProperties` and descriptions. The order number pattern lives in Python.
- Thinking tokens. On `claude-opus-5-5` thinking is always on and counts toward `max_tokens` and `output_tokens`. On the gpt-5 family reasoning tokens count toward `max_output_tokens` and `output_tokens`. That is why the default `max_tokens` is 4096 and the estimate allows 300 output tokens for one short tool call.
- Model choice. The default Anthropic model is Claude Opus 5.5, `claude-opus-5-5`, at $4.00 input and $20.00 output per million tokens, list price checked on 2026-10-09. It is the default model in the claude-api skill, whose model table was cached on 2026-10-06. It accepts `effort: low`. The adapter sends no temperature and never disables thinking, which Opus 5.5 rejects. Claude Opus 5, `claude-opus-5`, was the default before. It keeps its row in `prices.py`, so `LAB_ANTHROPIC_MODEL=claude-opus-5` still gets a cost estimate.
- Served model id. The report prints the id the provider says it served. A dated snapshot id, such as `gpt-5.6-sol-2026-08-01`, is priced as its base id. An id with no row in `prices.py` gets no dollar figure.

## What the adapter does not do

The adapter is shared by three labs and is not edited here. Four limits matter for this lab:

- A failed call carries no usage. Tokens spent on a prose answer (`no_tool_call`) are not in the report's totals. The report says so.
- If one response holds several tool calls, the adapter keeps the last. It does not turn parallel tool calls off. Each request here names one order, so one call is expected.
- One turn only. The adapter returns the tool call but not its id, and it cannot send the tool result back to the model. The lab stops at execution and prints the result the caller would have read. A full request, execution, result loop needs an adapter that carries a conversation.
- On OpenAI, arguments that are not valid JSON come back as a typed `no_tool_call` failure, and the lab records it and moves on. Arguments that parse to something other than an object become `{}`, which reaches the validator as a `missing_field` rejection. With `strict: true` neither should happen.

## Versions, and where this lab departs from the design

The design is `docs/research/labs.md` in the site repository, section 3.2, verified on 2026-09-15 against anthropic 1.6.0 and openai 3.14.1.

Pinned on 2026-10-09, matching the Models lab: anthropic 1.13.0, openai 3.27.0, pytest 9.1.1, ruff 0.16.10, Python 3.12.13. uv resolves ruff 0.17.0 today with an open pin. The lab keeps 0.16.10 so the three labs share one toolchain. The tool-use signatures this lab relies on were confirmed by introspecting these versions: `messages.create` takes `tools` and `tool_choice` and has no `temperature`, `ToolParam` takes `strict`, `ToolUseBlock.input` is a dict, `responses.create` takes `tools` and `temperature`, `FunctionToolParam` takes `parameters` and `strict`, and a function call's `arguments` is a string. Both `first_call.py` and `run.py` with the real adapter were run against a local fake server on both providers. No paid call was made.

Departures from labs.md section 3.2, which designed a `create_ticket` tool:

- The tool is `lookup_order`, a scoped read for the signed-in customer, not `create_ticket`. An order lookup gives the lab an executor against fixture data and a scope check, so out-of-scope calls can be rejected with typed errors. `create_ticket` had no executor and no scope check.
- Part 4 sends six requests, not one. The cost is a few cents, not under one cent.
- There is no simulated caller. Part 2 uses 13 hand-written calls in `data/fixture_calls.json` instead of 10 in `malformed_calls.json`. They add accepted calls and the two scope cases.
- The validator returns typed errors (`CallError` with a kind, a stage, a field, and a message) instead of a list of strings, and runs schema, rule and scope checks in that order.
- Data lives in `data/`. The modules are `contract.py`, `store.py`, `executor.py`, `scenarios.py`, `runlog.py` and `report.py`, in place of `tool_contract.py` and `simulated_caller.py`.
- `run.py` has `--limit` and `--resume`, with a run file, like the Models lab.
- A prose answer or a refusal is recorded and the loop moves on. Provider and setup failures stop the loop.
- `prices.py` is the Models lab's, with 300 estimated output tokens per call and a 500-token allowance for tool instructions.
- The adapter is the Models lab's canonical copy, which departs from labs.md section 2.4 in three ways: malformed tool arguments and any other SDK error return typed failures, and empty model variables count as unset. The Models lab README lists them.
- `pyproject.toml` pins exact versions with `==`, so every learner gets the versions the lab was checked with. labs.md section 4.1 used `>=`.
- ruff is pinned at 0.16.10. labs.md section 4.1 named 0.16.7.
