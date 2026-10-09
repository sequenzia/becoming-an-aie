"""Confusion matrix and per-label precision and recall. Pure functions.

Rows are the expected label. Columns are what the classifier said, plus one
column for answers the output contract rejected. Only single-label cases go
into the matrix. Ambiguous cases accept two labels, so they have no single
row, and the report shows them on their own.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

REJECTED = "(rejected)"

Matrix = dict[str, dict[str, int]]


@dataclass(frozen=True)
class LabelStats:
    """How one label did. precision or recall is None when undefined."""

    label: str
    correct: int
    predicted: int
    support: int

    @property
    def precision(self) -> float | None:
        """Of the cases given this label, the share that had it."""
        return self.correct / self.predicted if self.predicted else None

    @property
    def recall(self) -> float | None:
        """Of the cases that had this label, the share given it."""
        return self.correct / self.support if self.support else None


def confusion(pairs: Iterable[tuple[str, str]], labels: Sequence[str]) -> Matrix:
    """Count (expected, predicted) pairs. Unknown predictions go to REJECTED."""
    columns = [*labels, REJECTED]
    matrix: Matrix = {row: dict.fromkeys(columns, 0) for row in labels}
    for expected, predicted in pairs:
        if expected not in matrix:
            raise ValueError(f"{expected!r} is not a label.")
        column = predicted if predicted in labels else REJECTED
        matrix[expected][column] += 1
    return matrix


def per_label(matrix: Matrix, labels: Sequence[str]) -> list[LabelStats]:
    """Precision and recall for every label, in label order."""
    stats: list[LabelStats] = []
    for label in labels:
        stats.append(
            LabelStats(
                label=label,
                correct=matrix[label][label],
                predicted=sum(matrix[row][label] for row in labels),
                support=sum(matrix[label].values()),
            )
        )
    return stats


def share(part: int, whole: int) -> float | None:
    """part / whole, or None when whole is zero."""
    return part / whole if whole else None


def percent(value: float | None) -> str:
    """'83%' or 'n/a'."""
    return "n/a" if value is None else f"{round(value * 100)}%"


def format_matrix(matrix: Matrix, labels: Sequence[str]) -> str:
    """The matrix as a fixed-width table. Rows expected, columns predicted."""
    columns = [*labels, REJECTED]
    first = max(len("expected"), *(len(label) for label in labels)) + 2
    widths = [max(len(column), 3) + 2 for column in columns]
    header = "expected".ljust(first) + "".join(
        column.rjust(width) for column, width in zip(columns, widths, strict=True)
    )
    lines = ["Rows: expected label. Columns: the label given.", header]
    for row in labels:
        cells = "".join(
            str(matrix[row][column]).rjust(width)
            for column, width in zip(columns, widths, strict=True)
        )
        lines.append(row.ljust(first) + cells)
    return "\n".join(lines)


def format_stats(stats: Sequence[LabelStats]) -> str:
    """Per-label precision and recall as a fixed-width table."""
    first = max(len("label"), *(len(item.label) for item in stats)) + 2
    lines = [
        "label".ljust(first) + "precision".rjust(16) + "recall".rjust(16),
    ]
    for item in stats:
        precision = f"{percent(item.precision)} ({item.correct}/{item.predicted})"
        recall = f"{percent(item.recall)} ({item.correct}/{item.support})"
        lines.append(item.label.ljust(first) + precision.rjust(16) + recall.rjust(16))
    return "\n".join(lines)
