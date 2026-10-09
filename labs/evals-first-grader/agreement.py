"""Agreement between a grader and your labels.

Treat the grader as a classifier for one failure mode. Positive means the
failure is present. You are the reference. Four counts follow:

- true positive: you and the grader both say the failure is present
- false negative: you say present, the grader passed it (a miss)
- false positive: the grader flagged it, you say it is fine (a false alarm)
- true negative: both say it is not present

True positive rate (TPR) is how many of your failures the grader catches.
True negative rate (TNR) is how many good outputs it passes. Accuracy alone
hides which way the grader is wrong, so the lab prints all three, plus
Cohen's kappa, which discounts the agreement two raters would reach by
chance. Only ids that both sides judged are compared.
"""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Agreement:
    """The confusion counts and the ids where the two sides disagree."""

    true_positive: int
    false_negative: int
    false_positive: int
    true_negative: int
    misses: tuple[str, ...]
    false_alarms: tuple[str, ...]

    @property
    def compared(self) -> int:
        """How many ids both sides judged."""
        return (
            self.true_positive
            + self.false_negative
            + self.false_positive
            + self.true_negative
        )

    @property
    def agreed(self) -> int:
        """How many of those the two sides agree on."""
        return self.true_positive + self.true_negative

    @property
    def accuracy(self) -> float | None:
        """Share of compared ids where both sides agree."""
        return self.agreed / self.compared if self.compared else None

    @property
    def tpr(self) -> float | None:
        """Share of your failures the grader caught. None with no failures."""
        positives = self.true_positive + self.false_negative
        return self.true_positive / positives if positives else None

    @property
    def tnr(self) -> float | None:
        """Share of your passes the grader passed. None with no passes."""
        negatives = self.true_negative + self.false_positive
        return self.true_negative / negatives if negatives else None

    @property
    def kappa(self) -> float | None:
        """Cohen's kappa. None when chance agreement is total or nothing compared."""
        total = self.compared
        if not total:
            return None
        observed = self.agreed / total
        human_yes = (self.true_positive + self.false_negative) / total
        grader_yes = (self.true_positive + self.false_positive) / total
        chance = human_yes * grader_yes + (1 - human_yes) * (1 - grader_yes)
        if chance >= 1:
            return None
        return (observed - chance) / (1 - chance)


def measure(human: Mapping[str, bool], grader: Mapping[str, bool]) -> Agreement:
    """Compare on the ids both sides judged. True means the failure is present."""
    shared = sorted(set(human) & set(grader))
    tp = fn = fp = tn = 0
    misses: list[str] = []
    false_alarms: list[str] = []
    for item in shared:
        said, flagged = human[item], grader[item]
        if said and flagged:
            tp += 1
        elif said:
            fn += 1
            misses.append(item)
        elif flagged:
            fp += 1
            false_alarms.append(item)
        else:
            tn += 1
    return Agreement(tp, fn, fp, tn, tuple(misses), tuple(false_alarms))


def percent(value: float | None) -> str:
    """'83%' or 'n/a' when the rate is undefined."""
    return "n/a" if value is None else f"{value:.0%}"


def table(agreement: Agreement) -> list[str]:
    """The two-by-two table and the rates, as printable lines."""
    a = agreement
    kappa = "n/a" if a.kappa is None else f"{a.kappa:.2f}"
    return [
        "                        grader flags   grader passes",
        f"  you say failure       {a.true_positive:>12}   {a.false_negative:>13}",
        f"  you say no failure    {a.false_positive:>12}   {a.true_negative:>13}",
        "",
        f"  Compared: {a.compared}. Agreed: {a.agreed} ({percent(a.accuracy)}).",
        f"  TPR, failures caught: {percent(a.tpr)}. "
        f"TNR, good outputs passed: {percent(a.tnr)}. Kappa: {kappa}.",
    ]
