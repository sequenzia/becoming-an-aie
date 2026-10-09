# Review outputs and write a first grader

This lab is optional and does not count toward module completion.

It goes with the Verification and evals module of Becoming an AI Engineer. It is a small Python project, standalone, with no dependency on the site.

## What this lab teaches

Look at outputs before you write a grader. You read 30 replies from a support assistant, one at a time, and give each a pass or a fail with a short note in your own words. The lab groups your notes into a failure taxonomy, a Markdown file you edit until each category has a definition another reviewer could apply. Then you write a first code grader for the most common failure and the lab measures how often it agrees with you. You leave knowing that a grader is a hypothesis about quality, and that agreement with your labels is how you test it.

The replies are synthetic. They come from the support assistant of Cedar Support Software, a fictional help desk product. Each one comes with the customer's message, the facts the assistant could see, and the five rules it was given. No text comes from a real company or a real customer. The set has a planned mix of passes and failures across several kinds of failure. Some are borderline on purpose.

The lab has four parts. `run.py` prints the same part numbers. Only the last part calls a model, and it is optional.

- Part 1. Review. `review.py` shows one output at a time. You type p or f and a note. Every label is saved the moment you give it, so you can stop and continue later. No model, no cost.
- Part 2. Taxonomy. `run.py` groups your failing notes by the words they share and writes `work/taxonomy.md`. The grouping is crude on purpose. You rename, merge, split, move ids and write definitions. `run.py` then counts each category and names the most common.
- Part 3. Grader. `grader.py` holds the grader. It ships with a crude first attempt for one failure mode, so you can see the agreement step work before you change anything. `run.py` compares the grader with your labels and prints the counts, the true positive and true negative rates, Cohen's kappa, and every disagreement with your note beside the grader's reason.
- Part 4. Fresh outputs, optional. `run.py --model` asks the model for 20 new replies to 20 new customer messages, under the same rules, through the adapter. Your grader runs on them. Label them with `review.py --fresh` and the next `run.py` prints the grader's agreement on outputs it was not written against.

## What you need

- The lab files. They live in the site's public repository. Clone it and change into this lab:

  ```sh
  git clone https://github.com/sequenzia/becoming-an-aie.git
  cd becoming-an-aie/labs/evals-first-grader
  ```

  The directory is standalone. Copy it out of the repository and it still runs.
- uv, checked with uv 0.11.7 on 2026-10-09. On macOS or Linux, install it with `curl -LsSf https://astral.sh/uv/install.sh | sh`. On Windows, use `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`. uv fetches Python 3.12 for you.
- For parts 1 to 3, nothing else. No key, no network.
- For part 4 and for `first_call.py`, one API key.

## Explicit calls first

The lab follows the book's order: the raw call, then the abstraction.

Step 1. `first_call.py`. One raw call with the provider's own SDK, for whichever key is set. It prints the cost of the call before it makes it. It sends one customer message with its facts and prints the reply, the served model id, and the token usage. Read it first. Then ask the lab's question of the reply: is every date in it in the facts?

Step 2. `adapter.py`. The same call, wrapped once. `complete(TaskRequest) -> TaskResult | TaskFailure` takes a request and returns text, usage, timing, and model identity, or a typed failure. It never raises: every SDK error comes back as a typed failure. Provider-specific code lives only here and in `first_call.py`. This file is a byte-for-byte copy of `labs/models-first-measurable-feature/adapter.py`. Do not edit it here.

Step 3. The lab. `run.py` only calls `adapter.complete`. It does not import a provider SDK. Its four parts are listed above.

## Setup

From the lab directory:

```sh
uv sync
```

For part 4 and `first_call.py` only:

```sh
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
uv run python review.py                # label the 30 outputs by hand
uv run python run.py                   # taxonomy, grader, plan for the model step
uv run python run.py --dry-run         # the same, and stop before any paid call
uv run python first_call.py            # one raw call, needs a key
uv run python run.py --model           # 20 fresh replies, needs a key
uv run python run.py --model --limit 5 # at most 5 calls this time
uv run python run.py --model --resume  # continue the newest run for this model
uv run python review.py --fresh        # label the fresh replies by hand
```

Do the review before you look at anything else in `data/`. When you want to see the rest of the lab first, or compare your work with another reviewer's, use one reviewer's labels and edited taxonomy:

```sh
uv run python run.py --labels data/reference_labels.jsonl --taxonomy data/reference_taxonomy.md
```

Your files live in `work/`: `labels.jsonl`, `taxonomy.md`, and one labels file per model run. Model runs live in `runs/`. Both folders are ignored by git. Delete `work/taxonomy.md` to have the lab propose a new grouping from your current notes.

Time. The review takes 10 to 15 minutes for 30 outputs. `run.py` gives the same figure when you have no labels yet. Parts 2 and 3 run in seconds. Part 4 makes 20 sequential calls at a few seconds each: 1 to 3 minutes. Every `run.py` and `review.py` command finishes in well under ten minutes of machine time. The whole lab, with your review, your taxonomy edits and your grader, takes about 20 to 30 minutes. That is longer than the ten minutes the design set. The departures below say why.

If a model run fails on its first call, the run file holds no replies. `run.py` and `review.py --fresh` then say so and tell you to continue with `uv run python run.py --model --resume`.

## Write your grader

Open `grader.py`. Three things matter.

- `CATEGORY` names the failure the grader checks. Spell it as the heading in your `work/taxonomy.md`. `run.py` counts a fail label as a failure for this grader only when it is filed under that category. Fails in other categories count as no failure, because this grader was never meant to catch them. When `CATEGORY` matches no heading, `run.py` says so and falls back to every fail label.
- `grade(output)` returns a `Verdict(passed, reason)`. It reads the output in front of it: the customer's message, the facts, the reply. It makes no model call.
- The shipped grader checks one failure mode: dates, weekdays and dollar amounts that appear in neither the facts nor the customer's message. Run `run.py` against your labels and read the disagreements. Some are the grader's fault. Some may be yours. Some show a rule that was never clear.

Write the grader for your most common category, then run `run.py` again. When you change the shipped grader, `tests/test_grader.py` describes the old one. Change those tests to describe yours.

How to read the numbers. Positive means the failure is present. The true positive rate (TPR) is the share of your failures the grader caught. The true negative rate (TNR) is the share of good outputs it passed. Accuracy alone hides which way a grader is wrong. Kappa discounts the agreement two raters would reach by chance. With 30 outputs every number is rough: one output moves a rate by several points.

## Cost

Parts 1 to 3 cost nothing. `run.py` computes the estimate for part 4 from the scenario count, the prompt length, and `prices.py`, and prints it before the first call. On the full set it says:

- 20 calls. About 6,100 input tokens in total, roughly 300 per call, and 8,000 output tokens, 400 per call. Output includes the model's reasoning tokens.
- On `claude-opus-5-5` at $4.00 input and $20.00 output per million tokens, list price checked on 2026-10-09: about $0.18.
- On `gpt-5.6-sol` at $4.00 input and $20.00 output per million tokens, list price as of 2026-09-15: about $0.18.
- Order of magnitude: cents, under one dollar.

`first_call.py` is one call: about one cent at list prices checked on 2026-10-09. It prints that line, with the model id and the price date, before it calls.

Where the prices come from. Anthropic rows come from the claude-api skill's model table, cached 2026-10-06 and checked on 2026-10-09. OpenAI rows come from the OpenAI pricing page as read on 2026-09-15. They were not re-checked, because the models endpoint that would confirm them needs a key. After a run, `run.py` prints the tokens the provider reported and the cost at the list price, with its date. Prices change. Check the provider's pricing page before you trust a figure.

## Tests

```sh
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

The tests need no key and make no network call. They cover the adapter's no-key path (the typed `no_api_key` failure), provider selection, the shared result checks, malformed tool arguments and other SDK errors as typed failures through a stand-in client, empty model variables, loading the data files and refusing broken ones, the fixture's planned mix, the review loop driven by a scripted keyboard (pass, fail, the required note, skip, quit, end of input, resume, categories for fresh outputs), the proposed grouping, the taxonomy file round trip and its problem list, the shipped grader's extraction and verdicts, the agreement counts and rates, the model step's prompt and run file, the price lookup and cost arithmetic, `first_call.py` with no key, its cost line printed before the call, and its retry advice on an error, and `run.py` end to end with a scripted stand-in for `adapter.complete`: no key, the reference labels, a proposed taxonomy that is written once and then read, `--dry-run`, a run without `--model`, a full run, `--limit`, a retryable failure, `--resume`, a permanent failure, a model run with no replies, agreement on labelled fresh outputs, and that `run.py` and this README give the same review time.

## Files

| File | What it holds |
| --- | --- |
| `first_call.py` | Step 1. One raw SDK call per provider. |
| `adapter.py` | Step 2. The thin adapter. Copy of the Models lab's canonical file. |
| `data/policy.json` | The assistant's description and its five rules. |
| `data/outputs.jsonl` | The 30 synthetic outputs to review. |
| `data/scenarios.jsonl` | 20 new customer messages with facts, for part 4. |
| `data/reference_labels.jsonl` | One reviewer's labels and notes for the 30 outputs. |
| `data/reference_taxonomy.md` | That reviewer's edited taxonomy. |
| `records.py` | Loads the data files. Reads and appends labels. |
| `review.py` | The hand review, one output at a time. |
| `taxonomy.py` | The proposed grouping, the taxonomy file, the counts. |
| `grader.py` | Your grader. The file you edit. |
| `agreement.py` | Confusion counts, TPR, TNR, accuracy, kappa. |
| `fresh.py` | The model step's prompt and its run file. |
| `prices.py` | List prices with their dates, and the cost arithmetic. |
| `run.py` | The lab. |

## Behavior notes

- Retries. Both SDKs retry 429 and 5xx twice by default, with backoff. A `rate_limit` or `server` failure has already been tried three times. `latency_ms` is wall clock and includes those retries.
- Timeouts. Both SDK clients default to a 10 minute read timeout. If a slow network threatens the ten minute budget, pass `timeout=120.0` to both client constructors in `adapter.py`. That is a one-line change, and it is not part of the verified adapter. Make it in the Models lab's canonical copy and copy the file again, so the three labs stay identical. Then run `labs/check_adapter_copies.sh` from the repository. It fails if the three copies differ.
- Effort. The adapter sends `output_config={"effort": "low"}` to Anthropic and `reasoning={"effort": "low"}` to OpenAI. Low effort keeps short replies short and cheap. Claude Opus 5, Opus 5.5, Opus 4.8, Opus 4.7, Opus 4.6, Sonnet 5 and Sonnet 4.6 accept it. Claude Haiku 4.5 rejects it, so `LAB_ANTHROPIC_MODEL=claude-haiku-4-5` fails with `bad_request`. The gpt-5 family accepts `reasoning.effort`. Non-reasoning models such as gpt-4.1 reject it.
- Temperature. Never sent to Anthropic. anthropic 1.13.0 has no such parameter, and Claude Opus 5, Opus 5.5 and Fable 5 return 400 if it is sent. Sent to OpenAI only when a request sets it. This lab never sets it. A rejection arrives as a `bad_request` failure, not a stack trace.
- Refusals. `refusal` is a real stop reason on current Claude models. The adapter maps it to a typed `refusal` failure. It does not use the server-side `fallbacks` beta that the claude-api skill recommends by default for Opus 5 and Opus 5.5 code. Support replies should not trigger it.
- Tool calls. This lab sends no tool. The adapter's tool fields serve the Tools lab.
- Thinking tokens. On `claude-opus-5-5` thinking is always on and counts toward `max_tokens` and `output_tokens`. On the gpt-5 family reasoning tokens count toward `max_output_tokens` and `output_tokens`. That is why the default `max_tokens` is 4096 and why the estimate allows 400 output tokens for a reply under 120 words.
- Model choice. The default Anthropic model is Claude Opus 5.5, `claude-opus-5-5`, at $4.00 input and $20.00 output per million tokens, list price checked on 2026-10-09. It is the default model in the claude-api skill, whose model table was cached on 2026-10-06. It accepts `effort: low`. The adapter sends no temperature and never disables thinking, which Opus 5.5 rejects. Claude Opus 5, `claude-opus-5`, was the default before. It keeps its row in `prices.py`, so `LAB_ANTHROPIC_MODEL=claude-opus-5` still gets a cost estimate.
- Served model id. `run.py` prints the id the provider says it served. A dated snapshot id, such as `gpt-5.6-sol-2026-08-01`, is priced as its base id. An id with no row in `prices.py` gets no dollar figure.

## Versions, and where this lab departs from the design

The design is `docs/research/labs.md` in the site repository, section 3.3, verified on 2026-09-15 against anthropic 1.6.0 and openai 3.14.1.

Pinned on 2026-10-09: anthropic 1.13.0, openai 3.27.0, pytest 9.1.1, ruff 0.16.10, Python 3.12.13. Every locked package matches the Models lab. uv resolved anthropic, openai and pytest to these same versions today. It resolved ruff to 0.17.0, and this lab keeps 0.16.10 so the three labs share one ruff version. The call signatures, error classes and response fields the adapter uses were confirmed by introspecting the installed packages. No paid call was made.

Departures from labs.md section 3.3:

- The outputs under review are a support assistant's replies with the facts it could see, held to five rules. labs.md had a reply drafter held to four rules.
- The lab adds a taxonomy step. Your notes are grouped into `work/taxonomy.md`, which you edit, and the grader targets the most common category.
- The grader is one check for one failure mode. labs.md had four rule functions in one grader.
- The model step generates 20 fresh outputs for the same grader. labs.md had a model judge, `model_grader.py`, grading the 30 outputs. That file does not exist here.
- Agreement is measured for the grader's category, with the true positive and true negative rates beside accuracy and kappa.
- The data lives in `data/`, your labels and taxonomy in `work/`, model runs in `runs/`. One reviewer's labels and taxonomy ship in `data/`, so parts 2 and 3 can be seen before you review.
- 30 outputs: 17 pass and 13 fail.
- A note is required on every fail. labs.md made the note optional. The taxonomy is built from the fail notes, so a fail without a note gives it nothing to group.
- Labels on fresh outputs carry a category from your taxonomy. Agreement on fresh outputs then counts only the failures in the grader's category.
- Time. labs.md budgeted 5 minutes for the review and under 10 for the whole lab. With 30 outputs and a note on every fail, the review takes 10 to 15 minutes and the whole lab about 20 to 30. Every command still finishes in well under ten minutes. The lab keeps 30 outputs because fewer would leave most taxonomy categories with one or two members, and the agreement rates would rest on a handful of failures.
- `--dry-run`, `--limit` and `--resume` work as in the Models lab. `--limit N` means at most N model calls in this invocation.
- `prices.py` is the Models lab's file with a larger output estimate: 400 tokens per call instead of 200.
- The adapter is the Models lab's canonical copy, which departs from labs.md section 2.4 in three ways: malformed tool arguments and any other SDK error return typed failures, and empty model variables count as unset. The Models lab README lists them.
- `pyproject.toml` pins exact versions with `==`, so every learner gets the versions the lab was checked with. labs.md section 4.1 used `>=`.
- ruff is pinned at 0.16.10. labs.md section 4.1 named 0.16.7.
