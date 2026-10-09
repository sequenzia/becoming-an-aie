"""The executor and the result the caller would read."""

from contract import TOOL_NAME, Accepted, Rejected, Session, validate
from executor import error_result, execute, money
from store import load_store

STORE = load_store()


def test_a_summary_names_the_customer_beside_the_ids() -> None:
    result = execute(Accepted("cus_pellwick", "ORD-10421", "summary"), STORE)
    assert result == {
        "status": "found",
        "order_id": "ORD-10421",
        "customer": "Pellwick Dental Group",
        "placed_on": "2026-08-03",
        "order_status": "paid",
        "total": "$960.00",
        "line_count": 1,
    }


def test_line_items_are_added_only_when_asked_for() -> None:
    result = execute(Accepted("cus_pellwick", "ORD-10433", "line_items"), STORE)
    assert result["total"] == "$522.00"
    assert result["line_items"] == [
        {
            "description": "Extra seats, prorated to renewal",
            "quantity": 3,
            "unit_price": "$74.00",
            "amount": "$222.00",
        },
        {
            "description": "Phone support add-on, annual",
            "quantity": 1,
            "unit_price": "$300.00",
            "amount": "$300.00",
        },
    ]


def test_the_executor_still_scopes_the_lookup() -> None:
    forged = Accepted("cus_pellwick", "ORD-20877", "line_items")
    result = execute(forged, STORE)
    assert result["status"] == "not_found"
    assert "Tallgrass" not in str(result)
    assert "line_items" not in result


def test_the_error_result_hides_the_error_kind() -> None:
    verdict = validate(
        TOOL_NAME,
        {"order_id": "ORD-20877", "response_format": "summary"},
        Session("cus_pellwick"),
        STORE,
    )
    assert isinstance(verdict, Rejected)
    result = error_result(verdict)
    assert result == {
        "status": "rejected",
        "is_error": True,
        "errors": [
            {
                "field": "order_id",
                "message": "No order ORD-20877 on this customer's account.",
            }
        ],
    }
    assert "not_yours" not in str(result)


def test_money_formatting() -> None:
    assert money(118800) == "$1,188.00"
    assert money(1500) == "$15.00"
