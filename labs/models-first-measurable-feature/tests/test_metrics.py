"""Confusion matrix and per-label precision and recall."""

import pytest

from metrics import (
    REJECTED,
    confusion,
    format_matrix,
    format_stats,
    per_label,
    percent,
    share,
)

LABELS = ("billing", "bug", "other")


def test_confusion_counts_pairs_and_rejections() -> None:
    pairs = [
        ("billing", "billing"),
        ("billing", "bug"),
        ("bug", "bug"),
        ("bug", "nonsense"),
        ("other", REJECTED),
    ]
    matrix = confusion(pairs, LABELS)
    assert matrix["billing"] == {"billing": 1, "bug": 1, "other": 0, REJECTED: 0}
    assert matrix["bug"] == {"billing": 0, "bug": 1, "other": 0, REJECTED: 1}
    assert matrix["other"][REJECTED] == 1


def test_confusion_refuses_an_unknown_expected_label() -> None:
    with pytest.raises(ValueError, match="not a label"):
        confusion([("money", "billing")], LABELS)


def test_precision_and_recall() -> None:
    pairs = [
        ("billing", "billing"),
        ("billing", "billing"),
        ("billing", "bug"),
        ("bug", "billing"),
        ("bug", REJECTED),
    ]
    stats = {item.label: item for item in per_label(confusion(pairs, LABELS), LABELS)}
    assert stats["billing"].precision == pytest.approx(2 / 3)
    assert stats["billing"].recall == pytest.approx(2 / 3)
    assert stats["bug"].precision == 0.0
    assert stats["bug"].recall == 0.0
    assert stats["other"].precision is None
    assert stats["other"].recall is None


def test_share_and_percent() -> None:
    assert share(1, 4) == 0.25
    assert share(1, 0) is None
    assert percent(0.789) == "79%"
    assert percent(None) == "n/a"


def test_tables_render_every_label() -> None:
    matrix = confusion([("billing", "billing"), ("bug", "other")], LABELS)
    table = format_matrix(matrix, LABELS)
    assert REJECTED in table.splitlines()[1]
    assert len(table.splitlines()) == 2 + len(LABELS)
    stats = format_stats(per_label(matrix, LABELS))
    assert "100% (1/1)" in stats
    assert "n/a (0/0)" in stats
