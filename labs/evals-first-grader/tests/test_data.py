"""The shipped fixtures hold together: outputs, reference labels, taxonomy."""

import re

import taxonomy
from records import DATA_DIR, latest, load_outputs, load_scenarios, read_labels

REFERENCE = latest(read_labels(DATA_DIR / "reference_labels.jsonl"))
REFERENCE_TAXONOMY = taxonomy.parse(
    (DATA_DIR / "reference_taxonomy.md").read_text(encoding="utf-8")
)


def test_reference_labels_cover_every_output() -> None:
    assert set(REFERENCE) == {output.id for output in load_outputs()}


def test_the_planned_mix_of_passes_and_failures() -> None:
    fails = [label for label in REFERENCE.values() if label.label == "fail"]
    assert len(fails) == 13
    assert all(label.note for label in fails)


def test_every_reply_is_under_the_word_limit() -> None:
    assert all(len(output.reply.split()) < 120 for output in load_outputs())


def test_the_reference_taxonomy_files_every_failure_once() -> None:
    assert taxonomy.problems(REFERENCE_TAXONOMY, REFERENCE) == []
    counts = {c.name: n for c, n in taxonomy.counts(REFERENCE_TAXONOMY)}
    assert counts == {
        "invented-facts": 6,
        "promised-money": 3,
        "missed-handoff": 2,
        "wrong-question": 2,
    }


def test_scenarios_are_new_inputs() -> None:
    scenarios = load_scenarios()
    outputs = {output.customer for output in load_outputs()}
    assert len({s.id for s in scenarios}) == 20
    assert not any(s.customer in outputs for s in scenarios)


def test_no_data_file_holds_a_key_shaped_string() -> None:
    pattern = re.compile(r"sk-[A-Za-z0-9]{20,}|ghp_|AKIA[0-9A-Z]{16}|PRIVATE KEY")
    for path in DATA_DIR.iterdir():
        assert not pattern.search(path.read_text(encoding="utf-8")), path.name
