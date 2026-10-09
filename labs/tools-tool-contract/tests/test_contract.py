"""The validator: schema, rules, and scope, each with a typed error."""

import pytest

from contract import (
    INPUT_SCHEMA,
    STAGES,
    TOOL,
    TOOL_NAME,
    Accepted,
    Rejected,
    Session,
    check_schema,
    validate,
)
from store import load_store

STORE = load_store()
PELLWICK = Session("cus_pellwick")
TALLGRASS = Session("cus_tallgrass")


def good(order_id: str = "ORD-10421", fmt: str = "summary") -> dict[str, object]:
    return {"order_id": order_id, "response_format": fmt}


def rejected(arguments: object, session: Session = PELLWICK) -> Rejected:
    verdict = validate(TOOL_NAME, arguments, session, STORE)
    assert isinstance(verdict, Rejected)
    return verdict


def test_a_good_call_is_accepted_and_bound_to_the_session() -> None:
    verdict = validate(TOOL_NAME, good(fmt="line_items"), PELLWICK, STORE)
    assert verdict == Accepted("cus_pellwick", "ORD-10421", "line_items")


def test_an_order_that_belongs_to_another_customer_is_rejected() -> None:
    verdict = rejected(good("ORD-20877"))
    assert verdict.kinds == ("not_yours",)
    assert verdict.errors[0].stage == "scope"
    assert verdict.errors[0].field == "order_id"


def test_the_same_order_is_accepted_for_its_owner() -> None:
    verdict = validate(TOOL_NAME, good("ORD-20877"), TALLGRASS, STORE)
    assert isinstance(verdict, Accepted)
    assert verdict.customer_id == "cus_tallgrass"


def test_another_customers_order_reads_like_a_missing_one() -> None:
    theirs = rejected(good("ORD-20877")).errors[0]
    missing = rejected(good("ORD-20999")).errors[0]
    assert (theirs.kind, missing.kind) == ("not_yours", "not_found")
    assert theirs.message == missing.message.replace("ORD-20999", "ORD-20877")
    assert "Tallgrass" not in theirs.message
    assert "another" not in theirs.message


def test_a_customer_id_in_the_arguments_is_an_unknown_field() -> None:
    arguments = good("ORD-20877") | {"customer_id": "cus_tallgrass"}
    verdict = rejected(arguments)
    assert verdict.kinds == ("unknown_field",)
    assert verdict.errors[0].field == "customer_id"


def test_a_missing_field_is_named() -> None:
    verdict = rejected({"order_id": "ORD-10421"})
    assert verdict.kinds == ("missing_field",)
    assert "'response_format' is required." in verdict.errors[0].message


def test_schema_errors_are_collected_together() -> None:
    verdict = rejected({"order_id": 10421, "response_format": "all", "x": 1})
    assert set(verdict.kinds) == {"unknown_field", "wrong_type", "not_in_enum"}
    assert {error.stage for error in verdict.errors} == {"schema"}


@pytest.mark.parametrize(
    ("arguments", "kind"),
    [
        ({"order_id": 10421, "response_format": "summary"}, "wrong_type"),
        ({"order_id": True, "response_format": "summary"}, "wrong_type"),
        ({"order_id": None, "response_format": "summary"}, "wrong_type"),
        ({"order_id": "ORD-10421", "response_format": "full"}, "not_in_enum"),
        (["ORD-10421", "summary"], "not_an_object"),
        ("ORD-10421", "not_an_object"),
        (None, "not_an_object"),
    ],
)
def test_shape_errors(arguments: object, kind: str) -> None:
    assert rejected(arguments).kinds == (kind,)


@pytest.mark.parametrize(
    "order_id", ["10421", "ord-10421", "ORD-1042", "ORD-104211", " ORD-10421", ""]
)
def test_the_order_number_rule_is_beyond_the_schema(order_id: str) -> None:
    arguments = good(order_id)
    assert check_schema(INPUT_SCHEMA, arguments) == []
    verdict = rejected(arguments)
    assert verdict.kinds == ("bad_format",)
    assert verdict.errors[0].stage == "rule"
    assert "ORD- followed by five digits" in verdict.errors[0].message


def test_the_rule_runs_before_the_scope_check() -> None:
    assert rejected(good("20877")).kinds == ("bad_format",)


def test_an_unknown_tool_name_is_rejected_first() -> None:
    verdict = validate("get_order", ["not", "even", "an", "object"], PELLWICK, STORE)
    assert isinstance(verdict, Rejected)
    assert verdict.kinds == ("unknown_tool",)


def test_every_error_kind_has_a_stage() -> None:
    assert set(STAGES.values()) == {"schema", "rule", "scope"}


def test_the_wire_schema_is_strict_mode_compatible() -> None:
    schema = TOOL.input_schema
    properties = schema["properties"]
    assert isinstance(properties, dict)
    assert schema["additionalProperties"] is False
    assert schema["required"] == list(properties)
    assert "customer_id" not in properties
