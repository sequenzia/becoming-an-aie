"""The review loop, driven by a scripted keyboard."""

from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

import fresh
from adapter import TaskFailure, TaskResult
from records import latest, load_outputs, load_policy, read_labels
from review import main, review, show

OUTPUTS = load_outputs()
POLICY = load_policy()


def clock() -> datetime:
    return datetime(2026, 10, 9, 12, 0, 0, tzinfo=UTC)


class Keyboard:
    """Types the given answers in order. Runs out with EOFError, like Ctrl-D."""

    def __init__(self, answers: Iterable[str]) -> None:
        self.answers = list(answers)
        self.prompts: list[str] = []

    def __call__(self, prompt: str) -> str:
        self.prompts.append(prompt)
        if not self.answers:
            raise EOFError
        return self.answers.pop(0)


class Screen:
    """Collects what the loop prints."""

    def __init__(self) -> None:
        self.lines: list[str] = []

    def __call__(self, line: str) -> None:
        self.lines.append(line)

    @property
    def text(self) -> str:
        return "\n".join(self.lines)


def test_pass_fail_then_quit_writes_two_labels(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    keys = Keyboard(["p", "", "f", "invents a fix date", "q"])
    result = review(OUTPUTS, POLICY, path, keys, Screen(), clock=clock)
    labels = read_labels(path)
    assert [(label.id, label.label, label.note) for label in labels] == [
        ("R01", "pass", ""),
        ("R02", "fail", "invents a fix date"),
    ]
    assert labels[0].reviewed_at == "2026-10-09T12:00:00+00:00"
    assert result.labelled == 2
    assert result.stopped_early is True
    assert result.remaining == 28


def test_the_next_session_resumes_after_the_labelled_ones(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    review(OUTPUTS, POLICY, path, Keyboard(["p", "", "q"]), Screen(), clock=clock)
    screen = Screen()
    review(OUTPUTS, POLICY, path, Keyboard(["q"]), screen, clock=clock)
    assert "1 of 30 labelled. 29 to go." in screen.text
    assert "=== R02" in screen.text
    assert "=== R01" not in screen.text


def test_a_fail_needs_a_note(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    screen = Screen()
    keys = Keyboard(["f", "", "   ", "wrong date", "q"])
    review(OUTPUTS, POLICY, path, keys, screen, clock=clock)
    assert "A failing output needs a note." in screen.text
    assert read_labels(path)[0].note == "wrong date"


def test_unknown_keys_ask_again_and_skip_writes_nothing(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    screen = Screen()
    result = review(
        OUTPUTS, POLICY, path, Keyboard(["x", "s", "Pass", "", "q"]), screen
    )
    assert "Type p, f, s or q." in screen.text
    assert result.skipped == 1
    assert [label.id for label in read_labels(path)] == ["R02"]


def test_end_of_input_stops_cleanly_without_a_partial_label(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    result = review(OUTPUTS, POLICY, path, Keyboard(["f"]), Screen())
    assert result.stopped_early is True
    assert read_labels(path) == []


def test_categories_are_asked_for_on_a_fail_when_given(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    keys = Keyboard(["f", "invented a date", " invented-facts ", "p", "", "q"])
    review(
        OUTPUTS,
        POLICY,
        path,
        keys,
        Screen(),
        categories=["invented-facts", "missed-handoff"],
    )
    labels = latest(read_labels(path))
    assert labels["R01"].category == "invented-facts"
    assert labels["R02"].category == ""
    assert any("invented-facts, missed-handoff" in p for p in keys.prompts)


def test_a_fully_labelled_set_says_so(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    few = OUTPUTS[:2]
    review(few, POLICY, path, Keyboard(["p", "", "p", ""]), Screen())
    screen = Screen()
    result = review(few, POLICY, path, Keyboard([]), screen)
    assert "All 2 outputs already have a label." in screen.text
    assert result.remaining == 0


def test_show_presents_message_facts_and_reply() -> None:
    lines = show(OUTPUTS[1], "2 of 30")
    text = "\n".join(lines)
    assert lines[0] == "=== R02  (2 of 30) ==="
    assert "Known issue status: investigating, no fix date yet" in text
    assert "October 15" in text
    assert lines[-1].endswith("words)")


def test_main_writes_to_the_work_folder(tmp_path: Path) -> None:
    screen = Screen()
    code = main(
        [],
        input_fn=Keyboard(["p", "", "q"]),
        output_fn=screen,
        work_dir=tmp_path,
        runs_dir=tmp_path / "runs",
        clock=clock,
    )
    assert code == 0
    assert len(read_labels(tmp_path / "labels.jsonl")) == 1
    assert "29 still to label. Run the same command again." in screen.text


def test_main_fresh_with_no_run_explains(tmp_path: Path) -> None:
    screen = Screen()
    code = main(
        ["--fresh"],
        input_fn=Keyboard([]),
        output_fn=screen,
        work_dir=tmp_path,
        runs_dir=tmp_path / "runs",
    )
    assert code == 0
    assert "No model run in runs/ yet." in screen.text


def test_main_fresh_with_only_failed_calls_says_to_resume(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = runs / fresh.run_file_name("20261009T120000Z", "anthropic", "m")
    failure = TaskFailure("network", "Connection error.", retryable=True)
    fresh.append(run, fresh.from_failure("F01", failure, "m", "anthropic", "t"))
    screen = Screen()
    code = main(
        ["--fresh"],
        input_fn=Keyboard([]),
        output_fn=screen,
        work_dir=tmp_path,
        runs_dir=runs,
    )
    assert code == 0
    assert "has no replies yet" in screen.text
    assert fresh.RESUME_COMMAND in screen.text
    assert "already have a label" not in screen.text


def test_main_fresh_reviews_the_newest_run(tmp_path: Path) -> None:
    runs = tmp_path / "runs"
    run = runs / fresh.run_file_name("20261009T120000Z", "anthropic", "m")
    reply = TaskResult("Your trial ends on October 22.", 1, 1, 1, "m", "anthropic")
    fresh.append(run, fresh.from_result("F05", reply, "t"))
    (tmp_path / "taxonomy.md").write_text("## invented-facts\n\n- R02: x\n")
    keys = Keyboard(["f", "made up", "invented-facts"])
    screen = Screen()
    code = main(
        ["--fresh"], input_fn=keys, output_fn=screen, work_dir=tmp_path, runs_dir=runs
    )
    assert code == 0
    assert "Fresh outputs from fresh-20261009T120000Z-anthropic-m.jsonl." in screen.text
    labels = read_labels(fresh.labels_path(run, tmp_path))
    assert [(label.id, label.category) for label in labels] == [
        ("F05", "invented-facts")
    ]
