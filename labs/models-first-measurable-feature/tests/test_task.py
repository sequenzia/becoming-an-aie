"""The prompt, the output contract, and the check."""

import pytest

from cases import Case
from task import Rejected, build_prompt, check, normalize, validate

LABELS = ("billing", "bug", "how_to", "feature_request", "account", "other")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Billing.", "billing"),
        ("  bug\n", "bug"),
        ("how_to (I think)", "how_to"),
        ("**account**", "account"),
        ("`feature_request`", "feature_request"),
        ('"other"', "other"),
        ("", ""),
        ("   ", ""),
    ],
)
def test_normalize(raw: str, expected: str) -> None:
    assert normalize(raw) == expected


def test_validate_returns_the_label() -> None:
    assert validate("Billing.", LABELS) == "billing"


@pytest.mark.parametrize(
    ("raw", "reason"),
    [
        ("Refund", "'refund' is not in the label set"),
        ("I think billing", "'i' is not in the label set"),
        ("how-to", "'how-to' is not in the label set"),
        ("", "empty answer"),
    ],
)
def test_validate_rejects_anything_outside_the_label_set(raw: str, reason: str) -> None:
    assert validate(raw, LABELS) == Rejected(raw=raw, reason=reason)


def test_check_exact_accept_and_miss() -> None:
    exact = Case(id="a", input="x", expected="billing")
    either = Case(id="b", input="x", expected=None, accept=("billing", "account"))
    assert check(exact, "billing")
    assert not check(exact, "account")
    assert check(either, "account")
    assert not check(either, "bug")


def test_a_rejected_answer_is_never_correct() -> None:
    case = Case(id="a", input="x", expected="billing")
    assert not check(case, Rejected(raw="billing please", reason="r"))


def test_prompt_lists_every_label_and_asks_for_the_label_only() -> None:
    prompt = build_prompt(LABELS)
    for label in LABELS:
        assert f"\n{label}: " in prompt
    assert prompt.endswith("Answer with the category only.")
