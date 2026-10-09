"""The rules baseline."""

import pytest

from baseline import classify, hits
from cases import load


@pytest.mark.parametrize(
    ("text", "label"),
    [
        ("I was charged twice this month.", "billing"),
        ("The export crashes every time.", "bug"),
        ("How do I merge two tickets?", "how_to"),
        ("Please add a calendar view.", "feature_request"),
        ("I can't log in since Tuesday.", "account"),
        ("Do you sponsor meetups?", "other"),
    ],
)
def test_classify(text: str, label: str) -> None:
    assert classify(text) == label


def test_empty_text_is_other() -> None:
    assert classify("") == "other"
    assert hits("") == dict.fromkeys(hits("x"), 0)


def test_ties_go_to_the_first_label_in_priority() -> None:
    text = "My card was declined and now I can't log in."
    assert hits(text)["billing"] == hits(text)["account"] == 1
    assert classify(text) == "account"


def test_keywords_match_whole_words_only() -> None:
    assert classify("Our discharge summary template is fine.") == "other"


def test_the_baseline_number_the_readme_quotes() -> None:
    case_set = load()
    correct = sum(1 for case in case_set.cases if case.accepts(classify(case.input)))
    assert (correct, len(case_set.cases)) == (19, 24)
