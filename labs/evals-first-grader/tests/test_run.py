"""run.py end to end, with a scripted stand-in for adapter.complete.

No test makes a model call. The stand-in returns the replies a test wants,
and fails on the calls a test wants to fail.
"""

import io
import shutil
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

import pytest

import fresh
from adapter import TaskFailure, TaskRequest, TaskResult
from records import DATA_DIR, Label, append_label, read_labels
from run import REVIEW_TIME, Paths, main

FIXED = datetime(2026, 10, 9, 12, 0, 0, tzinfo=UTC)
RUN_FILE = "fresh-20261009T120000Z-anthropic-claude-opus-5-5.jsonl"
INVENTED = "Thanks for waiting. This will be fixed by October 20."
PLAIN = "Thanks for asking. Please follow the help article in Settings."


def clock() -> datetime:
    return FIXED


class Scripted:
    """Replies plainly, invents a date for F01, and fails where told to."""

    def __init__(self, fail_on: dict[int, TaskFailure] | None = None) -> None:
        self.fail_on = fail_on or {}
        self.requests: list[TaskRequest] = []

    def __call__(self, request: TaskRequest) -> TaskResult | TaskFailure:
        self.requests.append(request)
        number = len(self.requests)
        if number in self.fail_on:
            return self.fail_on[number]
        text = INVENTED if "ticket search" in request.user else PLAIN
        return TaskResult(
            text=text,
            input_tokens=320,
            output_tokens=260,
            latency_ms=1500,
            model="claude-opus-5-5",
            provider="anthropic",
        )


def never_called(request: TaskRequest) -> TaskResult | TaskFailure:
    raise AssertionError(f"A model call was made: {request.user}")


@pytest.fixture
def paths(tmp_path: Path) -> Paths:
    return Paths(work_dir=tmp_path / "work", runs_dir=tmp_path / "runs")


@pytest.fixture
def no_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "LAB_ANTHROPIC_MODEL",
        "LAB_OPENAI_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def anthropic_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LAB_ANTHROPIC_MODEL", raising=False)


def run(
    argv: list[str],
    paths: Paths,
    complete_fn: Callable[[TaskRequest], TaskResult | TaskFailure] = never_called,
) -> tuple[int, str]:
    out = io.StringIO()
    code = main(argv, complete_fn=complete_fn, paths=paths, out=out, clock=clock)
    return code, out.getvalue()


def flat(text: str) -> str:
    return " ".join(text.split())


def use_reference_labels(paths: Paths) -> None:
    paths.work_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(DATA_DIR / "reference_labels.jsonl", paths.work_dir / "labels.jsonl")


REFERENCE_ARGS = [
    "--labels",
    str(DATA_DIR / "reference_labels.jsonl"),
    "--taxonomy",
    str(DATA_DIR / "reference_taxonomy.md"),
]


@pytest.mark.usefixtures("no_keys")
def test_no_key_and_no_labels_prints_the_plan_and_exits_zero(paths: Paths) -> None:
    code, text = run([], paths)
    assert code == 0
    assert "No labels in work/labels.jsonl yet." in flat(text)
    assert "uv run python review.py" in text
    assert "The grader flags 7 of 30 outputs." in text
    assert "20 calls." in text
    assert "claude-opus-5-5 at $4.00 input and $20.00 output" in flat(text)
    assert "gpt-5.6-sol at $4.00 input and $20.00 output" in flat(text)
    assert "list price checked on 2026-10-09" in flat(text)
    assert "list price as of 2026-09-15" in flat(text)
    assert "Order of magnitude: cents" in flat(text)
    assert "No ANTHROPIC_API_KEY or OPENAI_API_KEY is set" in flat(text)
    assert "uv run python first_call.py" in text
    assert REVIEW_TIME in flat(text)
    assert not paths.runs_dir.exists()
    assert not paths.work_dir.exists()


def test_the_readme_gives_the_same_review_time() -> None:
    readme = (Path(__file__).parent.parent / "README.md").read_text(encoding="utf-8")
    assert "The review takes 10 to 15 minutes for 30 outputs." in readme
    assert "10 to 15 minutes for all 30 outputs" in REVIEW_TIME


@pytest.mark.usefixtures("no_keys")
def test_the_real_adapter_with_no_key_still_exits_zero(paths: Paths) -> None:
    out = io.StringIO()
    assert main(["--model"], paths=paths, out=out, clock=clock) == 0
    assert "makes no call" in flat(out.getvalue())


@pytest.mark.usefixtures("no_keys")
def test_reference_labels_give_the_reference_agreement(paths: Paths) -> None:
    code, text = run(REFERENCE_ARGS, paths)
    assert code == 0
    assert "30 of 30 outputs labelled. 17 pass, 13 fail." in flat(text)
    assert "Most common: invented-facts, 6 of 13 failures." in flat(text)
    assert "the 6 fail labels filed under invented-facts" in flat(text)
    assert "Compared: 30. Agreed: 27 (90%)." in text
    assert "TPR, failures caught: 83%. TNR, good outputs passed: 92%." in text
    assert "Kappa: 0.71." in text
    assert "- R18. You: says the bug is fixed." in flat(text)
    assert "- R13. Grader: states $240.00" in flat(text)
    assert not paths.work_dir.exists()


@pytest.mark.usefixtures("no_keys")
def test_your_labels_get_a_proposed_taxonomy_written_once(paths: Paths) -> None:
    use_reference_labels(paths)
    code, text = run([], paths)
    tax_file = paths.work_dir / "taxonomy.md"
    assert code == 0
    assert "Grouped your 13 failing notes" in flat(text)
    assert tax_file.exists()
    assert "## fact" in tax_file.read_text(encoding="utf-8")
    assert "'invented-facts' is not a category in your taxonomy" in flat(text)
    assert "Compared: 30. Agreed: 20 (67%)." in text
    edited = (DATA_DIR / "reference_taxonomy.md").read_text(encoding="utf-8")
    tax_file.write_text(edited, encoding="utf-8")
    _, again = run([], paths)
    assert "Read work/taxonomy.md, the file you edit." in flat(again)
    assert "Compared: 30. Agreed: 27 (90%)." in again
    assert tax_file.read_text(encoding="utf-8") == edited


@pytest.mark.usefixtures("no_keys")
def test_a_misfiled_taxonomy_lists_its_problems(paths: Paths) -> None:
    use_reference_labels(paths)
    run([], paths)
    _, text = run([], paths)
    assert "- fact has no definition yet." in flat(text)
    assert "Your most common category" not in text


@pytest.mark.usefixtures("no_keys")
def test_few_labels_are_called_thin(paths: Paths) -> None:
    labels = paths.work_dir / "labels.jsonl"
    append_label(labels, Label("R02", "fail", "invents a fix date", "t"))
    append_label(labels, Label("R03", "pass", "", "t"))
    _, text = run([], paths)
    assert "2 of 30 outputs labelled. 1 pass, 1 fail." in flat(text)
    assert "fewer than 20. The numbers below are thin." in flat(text)
    assert "Compared: 2." in text


@pytest.mark.usefixtures("anthropic_key")
def test_dry_run_stops_before_any_call(paths: Paths) -> None:
    code, text = run(["--model", "--dry-run"], paths, never_called)
    assert code == 0
    assert "Provider: anthropic. Model: claude-opus-5-5." in text
    assert "Cost estimate: 20 calls." in flat(text)
    assert "Dry run: stopping before any paid call." in text
    assert "uv run python first_call.py" in text
    assert not paths.runs_dir.exists()


@pytest.mark.usefixtures("anthropic_key")
def test_without_the_model_flag_no_call_is_made(paths: Paths) -> None:
    code, text = run([], paths, never_called)
    assert code == 0
    assert "No call made. To run this part, add --model:" in text


@pytest.mark.usefixtures("anthropic_key")
def test_the_model_override_changes_the_estimate(
    paths: Paths, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LAB_ANTHROPIC_MODEL", "claude-opus-5")
    _, text = run(["--dry-run"], paths)
    assert "claude-opus-5 at $5.00 input and $25.00 output" in flat(text)
    monkeypatch.setenv("LAB_ANTHROPIC_MODEL", "claude-unlisted")
    _, text = run(["--dry-run"], paths)
    assert "no list price for claude-unlisted" in flat(text)


@pytest.mark.usefixtures("anthropic_key")
def test_a_full_model_run_writes_replies_and_grades_them(paths: Paths) -> None:
    fake = Scripted()
    code, text = run(["--model"], paths, fake)
    assert code == 0
    assert len(fake.requests) == 20
    assert all("Rules:\n1. Use only the facts" in r.system for r in fake.requests)
    assert fake.requests[0].user.startswith("Facts you can see:\n- Today: 2026-10-08")
    records = fresh.read(paths.runs_dir / RUN_FILE)
    assert [r.status for r in records] == ["answered"] * 20
    assert "F01 grader FLAG: states October 20" in flat(text)
    assert "The grader flags 1 of 20 fresh replies, against 7 of 30" in flat(text)
    assert "Tokens: 6,400 input, 5,200 output." in flat(text)
    assert "uv run python review.py --fresh" in text


@pytest.mark.usefixtures("anthropic_key")
def test_limit_caps_the_calls(paths: Paths) -> None:
    fake = Scripted()
    code, text = run(["--model", "--limit", "5"], paths, fake)
    assert code == 0
    assert len(fake.requests) == 5
    assert "Cost estimate: 5 calls." in flat(text)
    assert "15 scenarios still without a reply." in flat(text)


@pytest.mark.usefixtures("anthropic_key")
def test_a_retryable_failure_stops_and_suggests_resume(paths: Paths) -> None:
    failure = TaskFailure("rate_limit", "Too many requests.", retryable=True)
    code, text = run(["--model"], paths, Scripted(fail_on={4: failure}))
    assert code == 1
    assert "Model call failed (rate_limit): Too many requests." in flat(text)
    assert "again with --resume to continue from F04" in flat(text)
    records = fresh.read(paths.runs_dir / RUN_FILE)
    assert [r.status for r in records] == ["answered"] * 3 + ["failed"]


@pytest.mark.usefixtures("anthropic_key")
def test_resume_skips_answered_scenarios(paths: Paths) -> None:
    failure = TaskFailure("server", "Overloaded.", retryable=True)
    run(["--model"], paths, Scripted(fail_on={4: failure}))
    second = Scripted()
    code, text = run(["--model", "--resume"], paths, second)
    assert code == 0
    assert len(second.requests) == 17
    assert "3 of 20 already have a reply" in flat(text)
    assert len(list(paths.runs_dir.glob("*.jsonl"))) == 1


@pytest.mark.usefixtures("anthropic_key")
def test_resume_with_no_earlier_run_starts_fresh(paths: Paths) -> None:
    code, text = run(["--model", "--resume", "--limit", "1"], paths, Scripted())
    assert code == 0
    assert "Starting a new run." in text


@pytest.mark.usefixtures("anthropic_key")
def test_a_permanent_failure_says_to_fix_the_cause(paths: Paths) -> None:
    failure = TaskFailure("auth", "Invalid key.", retryable=False)
    code, text = run(["--model"], paths, Scripted(fail_on={1: failure}))
    assert code == 1
    assert "Not retryable" in flat(text)
    assert "Fix the cause, then run again." in flat(text)


@pytest.mark.usefixtures("anthropic_key")
def test_a_model_run_with_no_replies_says_to_resume(paths: Paths) -> None:
    use_reference_labels(paths)
    failure = TaskFailure("network", "Connection error.", retryable=True)
    run(["--model"], paths, Scripted(fail_on={1: failure}))
    _, text = run([], paths)
    assert f"The newest model run, {RUN_FILE}, has no replies yet." in flat(text)
    assert fresh.RESUME_COMMAND in flat(text)
    assert "have no labels yet" not in flat(text)


@pytest.mark.usefixtures("anthropic_key")
def test_labelled_fresh_outputs_get_their_own_agreement(paths: Paths) -> None:
    use_reference_labels(paths)
    run(["--model", "--limit", "2"], paths, Scripted())
    _, text = run([], paths)
    assert "have no labels yet" in flat(text)
    fresh_labels = fresh.labels_path(paths.runs_dir / RUN_FILE, paths.work_dir)
    append_label(fresh_labels, Label("F01", "fail", "invents a date", "t", "fact"))
    append_label(fresh_labels, Label("F02", "pass", "", "t"))
    _, text = run([], paths)
    assert f"On the fresh outputs in {RUN_FILE}, labelled by you:" in flat(text)
    assert "Compared: 2. Agreed: 2 (100%)." in text
    assert len(read_labels(fresh_labels)) == 2


@pytest.mark.usefixtures("no_keys")
def test_a_broken_data_file_refuses_to_start(tmp_path: Path) -> None:
    bad = tmp_path / "outputs.jsonl"
    bad.write_text("not json\n", encoding="utf-8")
    out = io.StringIO()
    code = main([], paths=Paths(outputs=bad, work_dir=tmp_path), out=out)
    assert code == 1
    assert out.getvalue().startswith("Cannot start:")


def test_limit_must_be_positive(paths: Paths) -> None:
    with pytest.raises(SystemExit):
        run(["--limit", "0"], paths)
