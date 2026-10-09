"""Your first code grader. This is the file you edit.

A first grader checks one failure mode: the most common one in your
taxonomy. CATEGORY names that category, spelled as its heading in
work/taxonomy.md, so run.py knows which of your labels to compare against.

The lab ships a first attempt at one failure mode, so the agreement step
has something to measure before you write your own. It checks a reply for
dates, weekdays and dollar amounts that appear in neither the facts nor the
customer's message. It is deliberately crude. It cannot see a wrong status,
and it flags a correct sum it cannot find written down. Read the
disagreements run.py prints, then change this file and run again.

Rules for any grader you write here: grade(output) returns a Verdict, it
reads only the output in front of it, and it makes no model call.
"""

import re
from dataclasses import dataclass

from records import Output

CATEGORY = "invented-facts"
"""The taxonomy category this grader checks. Match your heading exactly."""

_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}
_MONTH = (
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?"
    r"|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)
_ISO_DATE = re.compile(r"\b\d{4}-(\d{2})-(\d{2})\b")
_MONTH_DAY = re.compile(rf"\b{_MONTH}\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?\b", re.I)
_DAY_MONTH = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?{_MONTH}\b", re.I)
_WEEKDAY = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", re.I
)
_MONEY = re.compile(r"\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?")


@dataclass(frozen=True)
class Verdict:
    """What the grader decided. reason says why when it fails."""

    passed: bool
    reason: str = ""


@dataclass(frozen=True)
class Claim:
    """A checkable fact in a piece of text, with a key to compare it by."""

    text: str
    key: str


def grade(output: Output) -> Verdict:
    """Fail a reply that states a date, weekday or amount nobody gave it."""
    known = {claim.key for claim in claims(_known_text(output))}
    unsupported = [claim for claim in claims(output.reply) if claim.key not in known]
    if not unsupported:
        return Verdict(passed=True)
    said = ", ".join(claim.text for claim in unsupported)
    return Verdict(
        passed=False,
        reason=f"states {said}, in neither the facts nor the customer's message",
    )


def claims(text: str) -> list[Claim]:
    """Dates, weekdays and dollar amounts in text, once each, in order found."""
    found: list[tuple[int, Claim]] = []
    for match in _ISO_DATE.finditer(text):
        month, day = int(match.group(1)), int(match.group(2))
        found.append((match.start(), Claim(match.group(0), _date_key(month, day))))
    for match in _MONTH_DAY.finditer(text):
        month, day = _month(match.group(1)), int(match.group(2))
        found.append((match.start(), Claim(match.group(0), _date_key(month, day))))
    for match in _DAY_MONTH.finditer(text):
        month, day = _month(match.group(2)), int(match.group(1))
        found.append((match.start(), Claim(match.group(0), _date_key(month, day))))
    for match in _WEEKDAY.finditer(text):
        name = match.group(1).lower()
        found.append((match.start(), Claim(match.group(0), f"weekday:{name}")))
    for match in _MONEY.finditer(text):
        dollars = int(match.group(1).replace(",", ""))
        cents = int((match.group(2) or "0").ljust(2, "0"))
        key = f"usd:{dollars * 100 + cents}"
        found.append((match.start(), Claim(match.group(0), key)))
    unique: dict[str, Claim] = {}
    for _, claim in sorted(found, key=lambda pair: pair[0]):
        unique.setdefault(claim.key, claim)
    return list(unique.values())


def _known_text(output: Output) -> str:
    facts = " ".join(f"{name}: {value}" for name, value in output.facts.items())
    return f"{facts} {output.customer}"


def _month(name: str) -> int:
    return _MONTHS[name[:3].lower()]


def _date_key(month: int, day: int) -> str:
    return f"date:{month:02d}-{day:02d}"
