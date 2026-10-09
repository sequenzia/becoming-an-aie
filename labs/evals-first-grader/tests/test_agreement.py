"""Agreement between a grader and the human labels."""

import pytest

from agreement import Agreement, measure, percent, table


def test_perfect_agreement() -> None:
    labels = {"a": True, "b": False, "c": True, "d": False}
    result = measure(labels, labels)
    assert (result.true_positive, result.true_negative) == (2, 2)
    assert result.accuracy == 1.0
    assert result.kappa == pytest.approx(1.0)
    assert result.misses == ()
    assert result.false_alarms == ()


def test_agreement_at_chance_gives_kappa_zero() -> None:
    human = {"a": True, "b": True, "c": False, "d": False}
    grader = {"a": True, "b": False, "c": True, "d": False}
    result = measure(human, grader)
    assert result.accuracy == 0.5
    assert result.kappa == pytest.approx(0.0)


def test_partial_agreement_gives_kappa_one_half() -> None:
    human = dict.fromkeys("abcd", True) | dict.fromkeys("efgh", False)
    grader = human | {"d": False, "h": True}
    result = measure(human, grader)
    assert (result.true_positive, result.false_negative) == (3, 1)
    assert (result.false_positive, result.true_negative) == (1, 3)
    assert result.misses == ("d",)
    assert result.false_alarms == ("h",)
    assert result.accuracy == 0.75
    assert result.kappa == pytest.approx(0.5)


def test_only_shared_ids_are_compared() -> None:
    result = measure({"a": True, "b": False}, {"b": True, "c": True})
    assert result.compared == 1
    assert result.false_alarms == ("b",)


def test_empty_input_is_safe() -> None:
    result = measure({}, {})
    assert result.compared == 0
    assert result.accuracy is None
    assert result.tpr is None
    assert result.tnr is None
    assert result.kappa is None


def test_rates_on_the_reference_numbers() -> None:
    result = Agreement(5, 1, 2, 22, ("R18",), ("R13", "R19"))
    assert result.accuracy == pytest.approx(0.9)
    assert result.tpr == pytest.approx(5 / 6)
    assert result.tnr == pytest.approx(22 / 24)
    assert result.kappa == pytest.approx(0.7059, abs=1e-4)


def test_rates_are_undefined_without_a_class() -> None:
    result = measure({"a": False, "b": False}, {"a": False, "b": True})
    assert result.tpr is None
    assert result.tnr == 0.5


def test_kappa_is_undefined_when_both_sides_say_the_same_thing_always() -> None:
    result = measure({"a": False, "b": False}, {"a": False, "b": False})
    assert result.kappa is None
    assert result.accuracy == 1.0


def test_percent_and_table() -> None:
    assert percent(None) == "n/a"
    assert percent(5 / 6) == "83%"
    lines = table(Agreement(5, 1, 2, 22, (), ()))
    joined = "\n".join(lines)
    assert "Compared: 30. Agreed: 27 (90%)." in joined
    assert "TPR, failures caught: 83%." in joined
    assert "Kappa: 0.71." in joined
