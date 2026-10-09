"""The lab's data: the policy, the outputs under review, and your labels.

Outputs and scenarios are read from data/. Labels are one JSON line each,
appended the moment you give one, so quitting a review loses nothing.
The latest label for an id wins, so you can change your mind by labelling
an output again.
"""

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Literal

DATA_DIR = Path(__file__).parent / "data"
WORK_DIR = Path(__file__).parent / "work"
DEFAULT_POLICY = DATA_DIR / "policy.json"
DEFAULT_OUTPUTS = DATA_DIR / "outputs.jsonl"
DEFAULT_SCENARIOS = DATA_DIR / "scenarios.jsonl"
DEFAULT_LABELS = WORK_DIR / "labels.jsonl"

Verdict = Literal["pass", "fail"]


class RecordError(ValueError):
    """A data file or a labels file could not be read."""


@dataclass(frozen=True)
class Policy:
    """What the assistant was told. The rules are what you review against."""

    product: str
    assistant: str
    rules: tuple[str, ...]


@dataclass(frozen=True)
class Scenario:
    """A customer message and the facts the assistant could see."""

    id: str
    customer: str
    facts: dict[str, str] = field(hash=False)


@dataclass(frozen=True)
class Output:
    """One reply under review, with what the assistant could see."""

    id: str
    customer: str
    facts: dict[str, str] = field(hash=False)
    reply: str


@dataclass(frozen=True)
class Label:
    """Your verdict on one output. The note is your open code."""

    id: str
    label: Verdict
    note: str
    reviewed_at: str
    category: str = ""


def load_policy(path: Path = DEFAULT_POLICY) -> Policy:
    """The policy file: product, assistant description, and the rules."""
    data = _json_object(path.read_text(encoding="utf-8"), f"{path.name}")
    rules = data.get("rules")
    if not isinstance(rules, list) or not all(isinstance(r, str) for r in rules):
        raise RecordError(f"{path.name}: rules must be a list of text.")
    return Policy(
        product=_text(data, "product", path.name),
        assistant=_text(data, "assistant", path.name),
        rules=tuple(rules),
    )


def load_scenarios(path: Path = DEFAULT_SCENARIOS) -> list[Scenario]:
    """Customer messages with facts, and no reply. The model step uses them."""
    scenarios: list[Scenario] = []
    for where, data in _json_lines(path):
        scenarios.append(
            Scenario(
                id=_text(data, "id", where),
                customer=_text(data, "customer", where),
                facts=_facts(data, where),
            )
        )
    _unique([s.id for s in scenarios], path.name)
    return scenarios


def load_outputs(path: Path = DEFAULT_OUTPUTS) -> list[Output]:
    """The outputs to review, in file order. Ids must be unique."""
    outputs: list[Output] = []
    for where, data in _json_lines(path):
        outputs.append(
            Output(
                id=_text(data, "id", where),
                customer=_text(data, "customer", where),
                facts=_facts(data, where),
                reply=_text(data, "reply", where),
            )
        )
    _unique([o.id for o in outputs], path.name)
    if not outputs:
        raise RecordError(f"{path.name} has no outputs.")
    return outputs


def format_facts(facts: dict[str, str]) -> list[str]:
    """One 'Name: value' line per fact, in file order."""
    return [f"{name}: {value}" for name, value in facts.items()]


def read_labels(path: Path) -> list[Label]:
    """Every label in the file, in the order written. A missing file is empty."""
    if not path.exists():
        return []
    labels: list[Label] = []
    for where, data in _json_lines(path):
        verdict = data.get("label")
        if verdict not in ("pass", "fail"):
            raise RecordError(f"{where}: label must be pass or fail.")
        labels.append(
            Label(
                id=_text(data, "id", where),
                label="pass" if verdict == "pass" else "fail",
                note=_text(data, "note", where, default=""),
                reviewed_at=_text(data, "reviewed_at", where, default=""),
                category=_text(data, "category", where, default=""),
            )
        )
    return labels


def latest(labels: list[Label]) -> dict[str, Label]:
    """The latest label per id. Relabelling an output replaces its label."""
    return {label.id: label for label in labels}


def append_label(path: Path, label: Label) -> None:
    """Write one label at once, creating the file and its folder if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(asdict(label), ensure_ascii=False) + "\n")


def _json_lines(path: Path) -> list[tuple[str, dict[str, object]]]:
    rows: list[tuple[str, dict[str, object]]] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            where = f"{path.name} line {number}"
            rows.append((where, _json_object(line, where)))
    return rows


def _json_object(text: str, where: str) -> dict[str, object]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RecordError(f"{where} is not JSON: {exc.msg}.") from exc
    if not isinstance(data, dict):
        raise RecordError(f"{where} is not a JSON object.")
    return data


def _text(
    data: dict[str, object], key: str, where: str, default: str | None = None
) -> str:
    value = data.get(key, default)
    if not isinstance(value, str):
        raise RecordError(f"{where}: {key} must be text.")
    if default is None and not value.strip():
        raise RecordError(f"{where}: {key} is empty.")
    return value


def _facts(data: dict[str, object], where: str) -> dict[str, str]:
    facts = data.get("facts")
    if not isinstance(facts, dict) or not facts:
        raise RecordError(f"{where}: facts must be a non-empty object.")
    checked: dict[str, str] = {}
    for name, value in facts.items():
        if not isinstance(value, str):
            raise RecordError(f"{where}: fact {name!r} must be text.")
        checked[str(name)] = value
    return checked


def _unique(ids: list[str], name: str) -> None:
    seen: set[str] = set()
    for item in ids:
        if item in seen:
            raise RecordError(f"{name}: id {item} appears twice.")
        seen.add(item)
