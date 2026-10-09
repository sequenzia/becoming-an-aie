"""The executor: runs an accepted call against the fixture data.

It runs only what the validator accepted, and it looks the order up through
the scoped query again. If the two ever disagreed, the executor would still
return nothing from another account.

The result is what the caller would read next: names beside stable ids, money
as text, and a status that says whether the order was found.
"""

from contract import Accepted, Rejected, not_found_message
from store import Order, OrderStore

ToolResult = dict[str, object]


def execute(call: Accepted, store: OrderStore) -> ToolResult:
    """The tool result for an accepted call."""
    order = store.find_for(call.customer_id, call.order_id)
    if order is None:
        return {"status": "not_found", "message": not_found_message(call.order_id)}
    customer = store.customer(order.customer_id)
    result: ToolResult = {
        "status": "found",
        "order_id": order.order_id,
        "customer": customer.name if customer is not None else "",
        "placed_on": order.placed_on,
        "order_status": order.status,
        "total": money(order.total_cents),
        "line_count": len(order.lines),
    }
    if call.response_format == "line_items":
        result["line_items"] = _lines(order)
    return result


def error_result(rejected: Rejected) -> ToolResult:
    """What the caller would read for a rejected call.

    It carries each field and message, never the error kind. The kind tells
    the owner that an order exists on another account. The caller must not
    learn that.
    """
    return {
        "status": "rejected",
        "is_error": True,
        "errors": [
            {"field": error.field, "message": error.message}
            for error in rejected.errors
        ],
    }


def money(cents: int) -> str:
    """'$1,188.00' from 118800."""
    return f"${cents / 100:,.2f}"


def _lines(order: Order) -> list[dict[str, object]]:
    return [
        {
            "description": line.description,
            "quantity": line.quantity,
            "unit_price": money(line.unit_price_cents),
            "amount": money(line.amount_cents),
        }
        for line in order.lines
    ]
