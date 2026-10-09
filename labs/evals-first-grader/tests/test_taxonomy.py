"""Grouping notes, writing the taxonomy file, reading it back, counting."""

from records import DATA_DIR, Label, latest, read_labels
from taxonomy import (
    DEFINITION_PROMPT,
    UNGROUPED,
    Category,
    Member,
    Taxonomy,
    counts,
    parse,
    problems,
    propose,
    render,
    words,
)

REFERENCE = latest(read_labels(DATA_DIR / "reference_labels.jsonl"))


def fail(item: str, note: str) -> Label:
    return Label(item, "fail", note, "t")


def test_words_drops_stopwords_and_plural_s() -> None:
    assert words("Says the facts were wrong; the dates too") == {
        "fact",
        "wrong",
        "date",
    }
    assert words("") == set()


def test_propose_groups_by_the_most_shared_word() -> None:
    labels = {
        "A": fail("A", "invented date"),
        "B": fail("B", "wrong date"),
        "C": fail("C", "no handoff"),
        "D": fail("D", "missed handoff"),
        "E": fail("E", "rude"),
        "F": Label("F", "pass", "fine", "t"),
    }
    result = propose(labels)
    assert [(c.name, sorted(c.ids)) for c in result.categories] == [
        ("date", ["A", "B"]),
        ("handoff", ["C", "D"]),
        (UNGROUPED, ["E"]),
    ]


def test_propose_on_the_reference_notes() -> None:
    result = propose(REFERENCE)
    grouped = {c.name: sorted(c.ids) for c in result.categories}
    assert grouped["fact"] == ["R02", "R06", "R10", "R16", "R18", "R22"]
    assert grouped["billing"] == ["R04", "R14", "R26"]
    assert grouped["handoff"] == ["R08", "R20"]
    assert grouped[UNGROUPED] == ["R12", "R24"]


def test_propose_with_no_failures_is_empty() -> None:
    assert propose({"A": Label("A", "pass", "", "t")}).categories == ()


def test_render_then_parse_round_trips() -> None:
    proposed = propose(REFERENCE)
    text = render(proposed, "work/labels.jsonl")
    assert "## fact" in text
    assert f"Definition: {DEFINITION_PROMPT}" in text
    parsed = parse(text)
    assert parsed.names() == proposed.names()
    assert [c.ids for c in parsed.categories] == [c.ids for c in proposed.categories]
    assert all(c.definition == "" for c in parsed.categories)


def test_parse_reads_an_edited_file_and_ignores_other_lines() -> None:
    text = """# Failure taxonomy

Some text the learner wrote.

## Invented facts

Definition: States a date the facts do not hold.
A loose remark under the heading.

- R02: invents a fix date
- R06 wrong renewal date
"""
    result = parse(text)
    category = result.find("invented FACTS ")
    assert category is not None
    assert category.definition == "States a date the facts do not hold."
    assert category.members == (
        Member("R02", "invents a fix date"),
        Member("R06", "wrong renewal date"),
    )
    assert result.find("missing") is None


def test_counts_rank_by_size_then_file_order() -> None:
    tax = Taxonomy(
        (
            Category("small", "d", (Member("A", ""),)),
            Category("big", "d", (Member("B", ""), Member("C", ""))),
            Category("also-small", "d", (Member("D", ""),)),
        )
    )
    assert [(c.name, n) for c, n in counts(tax)] == [
        ("big", 2),
        ("small", 1),
        ("also-small", 1),
    ]


def test_problems_name_what_keeps_the_counts_from_adding_up() -> None:
    labels = {
        "A": fail("A", "x"),
        "B": fail("B", "y"),
        "C": Label("C", "pass", "", "t"),
        "D": fail("D", "z"),
    }
    tax = Taxonomy(
        (
            Category("one", "", (Member("A", ""), Member("C", ""))),
            Category("two", "defined", (Member("A", ""), Member("B", ""))),
        )
    )
    found = problems(tax, labels)
    assert "one has no definition yet." in found
    assert "A is filed twice, under one and two." in found
    assert "C is filed under one but your label for it is not fail." in found
    assert "Failing outputs in no category: D." in found
    assert not any("two has no definition" in item for item in found)
