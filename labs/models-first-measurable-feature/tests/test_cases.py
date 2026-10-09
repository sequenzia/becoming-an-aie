"""Loading and checking the case set."""

import json
from pathlib import Path

import pytest

from cases import Case, CaseError, load, parse

CATEGORIES = ["billing", "bug", "other"]


def minimal(*cases: dict[str, object]) -> dict[str, object]:
    return {"task": "Label a ticket.", "categories": CATEGORIES, "cases": list(cases)}


def test_the_sample_file_loads() -> None:
    case_set = load()
    assert 20 <= len(case_set.cases) <= 25
    assert case_set.categories == (
        "billing",
        "bug",
        "how_to",
        "feature_request",
        "account",
        "other",
    )
    ambiguous = [case for case in case_set.cases if case.ambiguous]
    assert len(ambiguous) == 2
    for label in case_set.categories:
        assert any(case.expected == label for case in case_set.cases)


def test_a_case_with_no_answer_is_rejected() -> None:
    with pytest.raises(CaseError, match="neither 'expected' nor 'accept'"):
        parse(minimal({"id": "a", "input": "Charged twice."}))


def test_an_unknown_category_is_rejected() -> None:
    with pytest.raises(CaseError, match="not a category"):
        parse(minimal({"id": "a", "input": "Charged twice.", "expected": "money"}))


def test_an_unknown_accepted_label_is_rejected() -> None:
    case = {"id": "a", "input": "x", "accept": ["billing", "money"]}
    with pytest.raises(CaseError, match="not a category"):
        parse(minimal(case))


def test_both_expected_and_accept_is_rejected() -> None:
    case = {"id": "a", "input": "x", "expected": "bug", "accept": ["bug", "other"]}
    with pytest.raises(CaseError, match="both"):
        parse(minimal(case))


def test_accept_needs_two_labels() -> None:
    with pytest.raises(CaseError, match="at least two"):
        parse(minimal({"id": "a", "input": "x", "accept": ["bug"]}))


def test_duplicate_ids_are_rejected() -> None:
    first = {"id": "a", "input": "x", "expected": "bug"}
    with pytest.raises(CaseError, match="appears twice"):
        parse(minimal(first, dict(first)))


@pytest.mark.parametrize(
    "data",
    [
        [],
        {"categories": CATEGORIES, "cases": []},
        {"task": "t", "categories": [], "cases": []},
        {"task": "t", "categories": ["a", "a"], "cases": []},
        {"task": "t", "categories": CATEGORIES, "cases": []},
        {"task": "t", "categories": CATEGORIES, "cases": ["not an object"]},
        {"task": "t", "categories": CATEGORIES, "cases": [{"input": "x"}]},
        {"task": "t", "categories": CATEGORIES, "cases": [{"id": "a", "input": ""}]},
    ],
)
def test_malformed_files_are_rejected(data: object) -> None:
    with pytest.raises(CaseError):
        parse(data)


def test_load_reports_a_missing_file(tmp_path: Path) -> None:
    with pytest.raises(CaseError, match="Cannot read"):
        load(tmp_path / "missing.json")


def test_load_reports_bad_json(tmp_path: Path) -> None:
    path = tmp_path / "cases.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(CaseError, match="not valid JSON"):
        load(path)


def test_load_reads_a_good_file(tmp_path: Path) -> None:
    path = tmp_path / "cases.json"
    data = minimal({"id": "a", "input": "x", "accept": ["bug", "other"]})
    path.write_text(json.dumps(data), encoding="utf-8")
    case_set = load(path)
    assert case_set.cases == (
        Case(id="a", input="x", expected=None, accept=("bug", "other")),
    )


def test_accepts_uses_expected_or_the_accept_list() -> None:
    exact = Case(id="a", input="x", expected="bug")
    either = Case(id="b", input="x", expected=None, accept=("bug", "other"))
    assert exact.accepts("bug")
    assert not exact.accepts("other")
    assert either.accepts("other")
    assert not either.accepts("billing")
