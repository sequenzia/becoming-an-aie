"""Loading the data files, and writing and reading labels."""

from pathlib import Path

import pytest

from records import (
    Label,
    RecordError,
    append_label,
    format_facts,
    latest,
    load_outputs,
    load_policy,
    load_scenarios,
    read_labels,
)


def test_the_shipped_files_load() -> None:
    policy = load_policy()
    outputs = load_outputs()
    scenarios = load_scenarios()
    assert len(policy.rules) == 5
    assert "fictional" in policy.product
    assert len(outputs) == 30
    assert len(scenarios) == 20
    assert outputs[0].id == "R01"
    assert outputs[0].facts["Today"] == "2026-10-08"


def test_format_facts_keeps_file_order() -> None:
    lines = format_facts({"Plan": "Team", "Renewal date": "2026-11-03"})
    assert lines == ["Plan: Team", "Renewal date: 2026-11-03"]


def test_a_missing_labels_file_is_empty(tmp_path: Path) -> None:
    assert read_labels(tmp_path / "labels.jsonl") == []


def test_labels_are_appended_and_read_back(tmp_path: Path) -> None:
    path = tmp_path / "work" / "labels.jsonl"
    first = Label("R01", "pass", "", "2026-10-09T10:00:00+00:00")
    second = Label("R02", "fail", "invents a date", "2026-10-09T10:01:00+00:00")
    append_label(path, first)
    append_label(path, second)
    assert read_labels(path) == [first, second]


def test_the_latest_label_for_an_id_wins(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    append_label(path, Label("R01", "pass", "", "t1"))
    append_label(path, Label("R01", "fail", "missed a date", "t2"))
    labels = latest(read_labels(path))
    assert list(labels) == ["R01"]
    assert labels["R01"].label == "fail"


def test_a_label_must_be_pass_or_fail(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    path.write_text('{"id": "R01", "label": "maybe"}\n', encoding="utf-8")
    with pytest.raises(RecordError, match="pass or fail"):
        read_labels(path)


def test_a_broken_line_names_the_line(tmp_path: Path) -> None:
    path = tmp_path / "labels.jsonl"
    path.write_text('{"id": "R01", "label": "pass"}\nnot json\n', encoding="utf-8")
    with pytest.raises(RecordError, match="line 2"):
        read_labels(path)


def test_outputs_need_facts(tmp_path: Path) -> None:
    path = tmp_path / "outputs.jsonl"
    path.write_text(
        '{"id": "R01", "customer": "c", "facts": {}, "reply": "r"}\n',
        encoding="utf-8",
    )
    with pytest.raises(RecordError, match="facts"):
        load_outputs(path)


def test_output_ids_must_be_unique(tmp_path: Path) -> None:
    row = '{"id": "R01", "customer": "c", "facts": {"a": "b"}, "reply": "r"}\n'
    path = tmp_path / "outputs.jsonl"
    path.write_text(row + row, encoding="utf-8")
    with pytest.raises(RecordError, match="appears twice"):
        load_outputs(path)


def test_an_empty_reply_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "outputs.jsonl"
    path.write_text(
        '{"id": "R01", "customer": "c", "facts": {"a": "b"}, "reply": " "}\n',
        encoding="utf-8",
    )
    with pytest.raises(RecordError, match="reply is empty"):
        load_outputs(path)


def test_a_policy_needs_a_list_of_rules(tmp_path: Path) -> None:
    path = tmp_path / "policy.json"
    path.write_text('{"product": "p", "assistant": "a", "rules": "one"}')
    with pytest.raises(RecordError, match="rules"):
        load_policy(path)
