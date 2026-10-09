"""The failure taxonomy: your open notes grouped into categories you can count.

The lab proposes a first grouping with no model. It finds the word shared
by the most failing notes, makes that a group, and repeats on the notes
left over. Notes that share nothing go under "ungrouped". The proposal is a
starting point and nothing more. You rename the groups in the product's own
terms, merge and split them, move ids, and write a definition another
reviewer could apply. run.py reads the file you edited every time it runs.

The file format is plain Markdown:

    ## invented-facts

    Definition: The reply states a date or amount the facts do not hold.

    - R02: invents a fix date
"""

import re
from collections import Counter
from dataclasses import dataclass

from records import Label

UNGROUPED = "ungrouped"
DEFINITION_PROMPT = "write one line another reviewer could apply."
MIN_GROUP = 2

_STOPWORD_TEXT = """
    a about above after again against all also am an and any are as at be
    because been before being below between both but by can could did do
    does doing down during each few for from further had has have having he
    her here hers him his how i if in into is it its just me more most my no
    nor not now of off on once only or other our out over own same she
    should so some such than that the their them then there these they this
    those through to too under until up very was we were what when where
    which while who whom why will with would you your yours
    reply replies customer customers assistant instead says said say
"""
STOPWORDS = frozenset(_STOPWORD_TEXT.split())
"""Common words, plus words that appear in nearly every note in this domain."""

_WORD = re.compile(r"[a-z][a-z'-]*[a-z]|[a-z]")
_ITEM = re.compile(r"^-\s+([A-Za-z0-9_.-]+)\s*:?\s*(.*)$")


@dataclass(frozen=True)
class Member:
    """One failing output filed under a category, with your note."""

    id: str
    note: str


@dataclass(frozen=True)
class Category:
    """A named group of failures with its definition."""

    name: str
    definition: str
    members: tuple[Member, ...]

    @property
    def ids(self) -> set[str]:
        """The output ids filed here."""
        return {member.id for member in self.members}


@dataclass(frozen=True)
class Taxonomy:
    """Categories in file order."""

    categories: tuple[Category, ...]

    def find(self, name: str) -> Category | None:
        """The category with this name, ignoring case and surrounding space."""
        wanted = _key(name)
        for category in self.categories:
            if _key(category.name) == wanted:
                return category
        return None

    def names(self) -> list[str]:
        """Every category name, in file order."""
        return [category.name for category in self.categories]


def words(note: str) -> set[str]:
    """The content words in a note, lowercased, with a plural 's' dropped."""
    found: set[str] = set()
    for word in _WORD.findall(note.lower()):
        if word in STOPWORDS or len(word) < 3 or word.isdigit():
            continue
        if len(word) > 4 and word.endswith("s") and not word.endswith("ss"):
            word = word[:-1]
        found.add(word)
    return found


def propose(labels: dict[str, Label]) -> Taxonomy:
    """Group the failing notes by shared words. Deterministic, no model."""
    failing = [label for label in labels.values() if label.label == "fail"]
    left = {label.id: words(label.note) for label in failing}
    notes = {label.id: label.note for label in failing}
    order = [label.id for label in failing]
    categories: list[Category] = []
    while True:
        counts = Counter(word for ids in left.values() for word in ids)
        if not counts:
            break
        word, count = min(counts.items(), key=lambda item: (-item[1], item[0]))
        if count < MIN_GROUP:
            break
        chosen = [item for item in order if item in left and word in left[item]]
        categories.append(
            Category(
                name=word,
                definition="",
                members=tuple(Member(item, notes[item]) for item in chosen),
            )
        )
        for item in chosen:
            del left[item]
    rest = [item for item in order if item in left]
    if rest:
        members = tuple(Member(item, notes[item]) for item in rest)
        categories.append(Category(UNGROUPED, "", members))
    return Taxonomy(tuple(categories))


def render(taxonomy: Taxonomy, source: str) -> str:
    """The taxonomy as the Markdown file you edit."""
    lines = [
        "# Failure taxonomy",
        "",
        f"Proposed by run.py from the notes in {source}. Edit this file.",
        "Rename each category in the product's own terms. Merge, split, and",
        "move ids. Write a definition another reviewer could apply. run.py",
        "reads this file every time and counts each category. Keep the shape:",
        'one "## name" heading per category, one "Definition:" line, and one',
        '"- id: note" line per failing output. Delete the file to start over.',
    ]
    for category in taxonomy.categories:
        lines += ["", f"## {category.name}", ""]
        if category.name != UNGROUPED:
            definition = category.definition or DEFINITION_PROMPT
            lines += [f"Definition: {definition}", ""]
        lines += [f"- {member.id}: {member.note}" for member in category.members]
    return "\n".join(lines) + "\n"


def parse(text: str) -> Taxonomy:
    """Read an edited taxonomy file. Lines that are not part of it are ignored."""
    categories: list[Category] = []
    name: str | None = None
    definition = ""
    members: list[Member] = []

    def close() -> None:
        if name is not None:
            categories.append(Category(name, definition, tuple(members)))

    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("## "):
            close()
            name, definition, members = line[3:].strip(), "", []
            continue
        if name is None:
            continue
        if line.lower().startswith("definition:"):
            value = line.split(":", 1)[1].strip()
            definition = "" if value == DEFINITION_PROMPT else value
            continue
        match = _ITEM.match(line)
        if match:
            members.append(Member(match.group(1), match.group(2).strip()))
    close()
    return Taxonomy(tuple(categories))


def counts(taxonomy: Taxonomy) -> list[tuple[Category, int]]:
    """Categories with their counts, most common first, then by file order."""
    ranked = sorted(
        enumerate(taxonomy.categories),
        key=lambda pair: (-len(pair[1].ids), pair[0]),
    )
    return [(category, len(category.ids)) for _, category in ranked]


def problems(taxonomy: Taxonomy, labels: dict[str, Label]) -> list[str]:
    """What keeps the counts from adding up to your number of failures."""
    found: list[str] = []
    failing = {key for key, label in labels.items() if label.label == "fail"}
    seen: dict[str, str] = {}
    for category in taxonomy.categories:
        if not category.definition and category.name != UNGROUPED:
            found.append(f"{category.name} has no definition yet.")
        for member in category.members:
            if member.id in seen:
                found.append(
                    f"{member.id} is filed twice, under {seen[member.id]} "
                    f"and {category.name}."
                )
            seen.setdefault(member.id, category.name)
            if member.id not in failing:
                found.append(
                    f"{member.id} is filed under {category.name} but your "
                    "label for it is not fail."
                )
    unfiled = sorted(failing - set(seen))
    if unfiled:
        found.append(f"Failing outputs in no category: {', '.join(unfiled)}.")
    return found


def _key(name: str) -> str:
    return name.strip().lower()
