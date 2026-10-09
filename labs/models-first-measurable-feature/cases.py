"""Load the case set and refuse to start on a bad one.

A case has an id, the ticket text, and what counts as correct. Most cases
name one expected label. A few are ambiguous on purpose and list the labels
a reviewer would accept.
"""

import json
from dataclasses import dataclass
from pathlib import Path

DEFAULT_CASES = Path(__file__).parent / "data" / "cases.json"


class CaseError(ValueError):
    """The case file breaks a rule. The message says which one."""


@dataclass(frozen=True)
class Case:
    """One ticket and what counts as a correct answer."""

    id: str
    input: str
    expected: str | None
    accept: tuple[str, ...] = ()

    @property
    def ambiguous(self) -> bool:
        """True when the case accepts more than one label."""
        return self.expected is None

    def accepts(self, label: str) -> bool:
        """True when label is a correct answer for this case."""
        if self.expected is not None:
            return label == self.expected
        return label in self.accept


@dataclass(frozen=True)
class CaseSet:
    """The task, the fixed label set, and the cases."""

    task: str
    categories: tuple[str, ...]
    cases: tuple[Case, ...]


def parse(data: object) -> CaseSet:
    """Check the decoded JSON and build a CaseSet. Raises CaseError."""
    if not isinstance(data, dict):
        raise CaseError("The case file must hold a JSON object.")
    task = data.get("task")
    if not isinstance(task, str) or not task.strip():
        raise CaseError("The case file needs a non-empty 'task'.")
    categories = _string_list(data.get("categories"), "categories")
    if len(set(categories)) != len(categories):
        raise CaseError("'categories' has a duplicate label.")
    raw_cases = data.get("cases")
    if not isinstance(raw_cases, list) or not raw_cases:
        raise CaseError("The case file needs a non-empty 'cases' list.")
    cases: list[Case] = []
    seen: set[str] = set()
    for index, raw in enumerate(raw_cases):
        case = _parse_case(raw, index, categories)
        if case.id in seen:
            raise CaseError(f"Case id {case.id} appears twice.")
        seen.add(case.id)
        cases.append(case)
    return CaseSet(task=task, categories=tuple(categories), cases=tuple(cases))


def load(path: Path = DEFAULT_CASES) -> CaseSet:
    """Read and check a case file. Raises CaseError."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise CaseError(f"Cannot read {path}: {exc.strerror}.") from exc
    except json.JSONDecodeError as exc:
        raise CaseError(f"{path} is not valid JSON: {exc.msg}.") from exc
    return parse(data)


def _parse_case(raw: object, index: int, categories: list[str]) -> Case:
    if not isinstance(raw, dict):
        raise CaseError(f"Case {index + 1} is not an object.")
    case_id = raw.get("id")
    if not isinstance(case_id, str) or not case_id:
        raise CaseError(f"Case {index + 1} has no id.")
    text = raw.get("input")
    if not isinstance(text, str) or not text.strip():
        raise CaseError(f"Case {case_id} has no input text.")
    expected = raw.get("expected")
    accept = raw.get("accept")
    if expected is None and accept is None:
        raise CaseError(f"Case {case_id} has neither 'expected' nor 'accept'.")
    if expected is not None and accept is not None:
        raise CaseError(f"Case {case_id} has both 'expected' and 'accept'.")
    if expected is not None:
        if not isinstance(expected, str) or expected not in categories:
            raise CaseError(f"Case {case_id} expects {expected!r}, not a category.")
        return Case(id=case_id, input=text, expected=expected)
    labels = _string_list(accept, f"accept in case {case_id}")
    if len(labels) < 2:
        raise CaseError(f"Case {case_id} 'accept' needs at least two labels.")
    for label in labels:
        if label not in categories:
            raise CaseError(f"Case {case_id} accepts {label!r}, not a category.")
    return Case(id=case_id, input=text, expected=None, accept=tuple(labels))


def _string_list(value: object, name: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise CaseError(f"'{name}' must be a non-empty list of strings.")
    items: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item:
            raise CaseError(f"'{name}' must be a non-empty list of strings.")
        items.append(item)
    return items
