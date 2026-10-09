"""The tool contract: the definition the caller reads, and the validator.

The validator runs three checks in order, and stops at the first that fails:

1. Schema. The shape the JSON schema describes: the tool name, an object,
   the required fields, no unknown fields, the types, the enum.
2. Rules. What the schema cannot say: the order number's exact form.
3. Scope. Authorization. The order must belong to the signed-in customer.
   The customer comes from the session, never from the arguments.

Every rejection is a typed CallError. The kind is for the owner's report.
The message is what the caller would be told.
"""

import re
from dataclasses import dataclass
from typing import Literal

from adapter import ToolSpec
from store import OrderStore

TOOL_NAME = "lookup_order"
RESPONSE_FORMATS = ("summary", "line_items")
ORDER_ID_FORM = re.compile(r"ORD-\d{5}")

DESCRIPTION = (
    "Look up one order on the signed-in customer's Cedar Support account. "
    "Use it when the customer asks about an order they placed: whether it "
    "was paid, its total, or what it contained. Pass the order number exactly "
    "as the customer wrote it. Order numbers are ORD- followed by five digits, "
    "for example ORD-10421. Set response_format to 'summary' for the status "
    "and total, or 'line_items' when the customer asks what was on the order. "
    "The tool returns only orders on the signed-in customer's own account. It "
    "takes no customer id. It cannot change, cancel, or refund an order."
)

INPUT_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "order_id": {
            "type": "string",
            "description": "The order number from the customer, e.g. ORD-10421.",
        },
        "response_format": {
            "type": "string",
            "enum": list(RESPONSE_FORMATS),
            "description": "'summary' for status and total. 'line_items' adds "
            "each line with its quantity and price.",
        },
    },
    "required": ["order_id", "response_format"],
    "additionalProperties": False,
}

TOOL = ToolSpec(name=TOOL_NAME, description=DESCRIPTION, input_schema=INPUT_SCHEMA)

RULES = (
    "order_id is ORD- followed by exactly five digits. The schema only says "
    "it is a string.",
    "The order must belong to the signed-in customer. The customer comes from "
    "the session, not from the arguments, and an order on another account is "
    "reported to the caller exactly like an order that does not exist.",
)

ErrorKind = Literal[
    "unknown_tool",
    "not_an_object",
    "missing_field",
    "unknown_field",
    "wrong_type",
    "not_in_enum",
    "bad_format",
    "not_found",
    "not_yours",
]
Stage = Literal["schema", "rule", "scope"]

ERROR_KINDS: tuple[ErrorKind, ...] = (
    "unknown_tool",
    "not_an_object",
    "missing_field",
    "unknown_field",
    "wrong_type",
    "not_in_enum",
    "bad_format",
    "not_found",
    "not_yours",
)

STAGES: dict[str, Stage] = {
    "unknown_tool": "schema",
    "not_an_object": "schema",
    "missing_field": "schema",
    "unknown_field": "schema",
    "wrong_type": "schema",
    "not_in_enum": "schema",
    "bad_format": "rule",
    "not_found": "scope",
    "not_yours": "scope",
}


@dataclass(frozen=True)
class Session:
    """Who is signed in. The application authenticated them, not the model."""

    customer_id: str


@dataclass(frozen=True)
class CallError:
    """One reason a call was rejected."""

    kind: ErrorKind
    field: str
    message: str

    @property
    def stage(self) -> Stage:
        """Which of the three checks raised it."""
        return STAGES[self.kind]


@dataclass(frozen=True)
class Accepted:
    """A call that passed all three checks, bound to the session's customer."""

    customer_id: str
    order_id: str
    response_format: str


@dataclass(frozen=True)
class Rejected:
    """A call that failed a check. Nothing was executed."""

    errors: tuple[CallError, ...]

    @property
    def kinds(self) -> tuple[ErrorKind, ...]:
        """The error kinds, in the order found."""
        return tuple(error.kind for error in self.errors)


def validate(
    name: str, arguments: object, session: Session, store: OrderStore
) -> Accepted | Rejected:
    """Check one tool call before anything runs. Never raises."""
    if name != TOOL_NAME:
        return _reject(
            "unknown_tool", "", f"There is no tool named {name!r}. Use {TOOL_NAME}."
        )
    errors = check_schema(INPUT_SCHEMA, arguments)
    if errors:
        return Rejected(tuple(errors))
    order_id = _text_field(arguments, "order_id")
    response_format = _text_field(arguments, "response_format")
    if not ORDER_ID_FORM.fullmatch(order_id):
        return _reject(
            "bad_format",
            "order_id",
            f"{order_id!r} is not an order number. Order numbers are ORD- "
            "followed by five digits, for example ORD-10421. Ask the customer "
            "to check the number.",
        )
    if store.find_for(session.customer_id, order_id) is None:
        kind: ErrorKind = (
            "not_yours" if store.exists_anywhere(order_id) else "not_found"
        )
        return _reject(kind, "order_id", not_found_message(order_id))
    return Accepted(session.customer_id, order_id, response_format)


def not_found_message(order_id: str) -> str:
    """One message for both scope failures, so the caller learns nothing more."""
    return f"No order {order_id} on this customer's account."


def check_schema(schema: dict[str, object], arguments: object) -> list[CallError]:
    """The subset of JSON Schema this contract uses. Collects every error."""
    if not isinstance(arguments, dict):
        return [
            CallError(
                "not_an_object",
                "",
                f"Arguments must be a JSON object, not {_json_type(arguments)}.",
            )
        ]
    properties = schema.get("properties")
    required = schema.get("required")
    if not isinstance(properties, dict) or not isinstance(required, list):
        raise TypeError("The schema needs 'properties' and 'required'.")
    errors: list[CallError] = []
    for field in required:
        if field not in arguments:
            errors.append(CallError("missing_field", field, f"'{field}' is required."))
    if schema.get("additionalProperties") is False:
        for field in arguments:
            if field not in properties:
                errors.append(
                    CallError(
                        "unknown_field",
                        str(field),
                        f"'{field}' is not a field of this tool. Allowed: "
                        f"{', '.join(properties)}.",
                    )
                )
    for field, rule in properties.items():
        if field in arguments and isinstance(rule, dict):
            errors.extend(_check_value(field, rule, arguments[field]))
    return errors


def _check_value(field: str, rule: dict[str, object], value: object) -> list[CallError]:
    expected = rule.get("type")
    if isinstance(expected, str) and not _has_type(value, expected):
        return [
            CallError(
                "wrong_type",
                field,
                f"'{field}' must be {_JSON_NAMES.get(expected, expected)}, "
                f"not {_json_type(value)}.",
            )
        ]
    allowed = rule.get("enum")
    if isinstance(allowed, list) and value not in allowed:
        options = ", ".join(repr(option) for option in allowed)
        return [CallError("not_in_enum", field, f"'{field}' must be one of {options}.")]
    return []


def _has_type(value: object, expected: str) -> bool:
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, int | float) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    return False


_JSON_NAMES = {
    "string": "a string",
    "integer": "an integer",
    "number": "a number",
    "boolean": "true or false",
    "object": "an object",
    "array": "an array",
}


def _json_type(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true or false"
    if isinstance(value, int | float):
        return "a number"
    if isinstance(value, str):
        return "a string"
    if isinstance(value, list):
        return "an array"
    if isinstance(value, dict):
        return "an object"
    return type(value).__name__


def _text_field(arguments: object, key: str) -> str:
    """A string field from arguments that already passed check_schema."""
    value = arguments.get(key) if isinstance(arguments, dict) else None
    return value if isinstance(value, str) else ""


def _reject(kind: ErrorKind, field: str, message: str) -> Rejected:
    return Rejected((CallError(kind, field, message),))
