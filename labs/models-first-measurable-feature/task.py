"""The task, written down: the prompt, the output contract, and the check.

The contract is what the application accepts from the model. The model is
asked for one label. The code reads the first word, ignores case and
surrounding punctuation, and rejects anything that is not in the label set.
A rejected answer is never guessed into a label. It counts as wrong.
"""

import string
from collections.abc import Sequence
from dataclasses import dataclass

from cases import Case

DEFINITIONS: dict[str, str] = {
    "billing": "charges, invoices, receipts, refunds, payment methods, renewals.",
    "bug": "the product does something wrong, fails, or crashes.",
    "how_to": "the customer asks how to do something the product already does.",
    "feature_request": "the customer asks for something the product does not do.",
    "account": "sign-in, passwords, users, roles, and workspace ownership.",
    "other": "anything that fits none of the above.",
}

_STRIP = string.whitespace + string.punctuation.replace("_", "")


@dataclass(frozen=True)
class Rejected:
    """An answer the contract refused. raw is what the model said."""

    raw: str
    reason: str


def build_prompt(categories: Sequence[str]) -> str:
    """The system prompt: the label set with one-line definitions."""
    lines = [
        "You triage support tickets for Cedar Support, a help desk product.",
        "Assign exactly one category to the ticket.",
        "",
        "Categories:",
    ]
    for label in categories:
        definition = DEFINITIONS.get(label, "")
        lines.append(f"{label}: {definition}".rstrip())
    lines += ["", "Answer with the category only."]
    return "\n".join(lines)


def normalize(text: str) -> str:
    """Lowercase, trim, keep the first word, drop punctuation around it."""
    words = text.strip().lower().split()
    if not words:
        return ""
    return words[0].strip(_STRIP)


def validate(text: str, categories: Sequence[str]) -> str | Rejected:
    """Apply the output contract. Return the label, or why it was rejected."""
    label = normalize(text)
    if not label:
        return Rejected(raw=text, reason="empty answer")
    if label not in categories:
        return Rejected(raw=text, reason=f"{label!r} is not in the label set")
    return label


def check(case: Case, answer: str | Rejected) -> bool:
    """True when a validated answer is correct for the case."""
    if isinstance(answer, Rejected):
        return False
    return case.accepts(answer)
