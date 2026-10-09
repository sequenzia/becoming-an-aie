"""The rules baseline. No model, no cost, instant.

Each label has a list of keywords and phrases. The label with the most hits
wins. Ties go to the label listed first in PRIORITY. No hit at all means
"other". The rules are deliberately plain: the point is a number the model
has to beat on the same cases, not a clever classifier.
"""

import re

KEYWORDS: dict[str, tuple[str, ...]] = {
    "billing": (
        "charge",
        "charged",
        "invoice",
        "invoices",
        "receipt",
        "refund",
        "payment",
        "renewal",
        "card",
        "billing",
    ),
    "bug": (
        "crash",
        "crashes",
        "error",
        "broken",
        "blank",
        "wrong",
        "does nothing",
        "not working",
        "stopped working",
    ),
    "how_to": (
        "how do i",
        "how to",
        "where can i",
        "is there a way",
    ),
    "feature_request": (
        "please add",
        "would be great",
        "we'd love",
        "could you add",
        "feature",
        "integration",
    ),
    "account": (
        "log in",
        "login",
        "password",
        "sign in",
        "workspace",
        "owner",
        "two-factor",
    ),
}

PRIORITY: tuple[str, ...] = ("bug", "account", "billing", "feature_request", "how_to")
FALLBACK = "other"


def hits(text: str) -> dict[str, int]:
    """How many keywords of each label appear in the text."""
    lowered = text.lower()
    counts: dict[str, int] = {}
    for label, words in KEYWORDS.items():
        counts[label] = sum(1 for word in words if _contains(lowered, word))
    return counts


def classify(text: str) -> str:
    """The baseline's label for one ticket."""
    counts = hits(text)
    best = max(counts.values(), default=0)
    if best == 0:
        return FALLBACK
    for label in PRIORITY:
        if counts.get(label, 0) == best:
            return label
    return FALLBACK


def _contains(text: str, word: str) -> bool:
    return re.search(rf"(?<![\w']){re.escape(word)}(?![\w'])", text) is not None
