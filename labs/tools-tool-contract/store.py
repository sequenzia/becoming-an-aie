"""The fixture data the tool reads: customers and their orders.

This stands in for the system of record. It is synthetic. Cedar Support
Software and its customers are fictional.
"""

import json
from dataclasses import dataclass
from pathlib import Path

DEFAULT_ORDERS = Path(__file__).parent / "data" / "orders.json"

ORDER_STATUSES = ("paid", "pending", "payment_failed", "refunded")


class StoreError(ValueError):
    """The fixture file is missing a field or contradicts itself."""


@dataclass(frozen=True)
class Customer:
    """One customer account."""

    customer_id: str
    name: str


@dataclass(frozen=True)
class LineItem:
    """One line on an order. Prices are whole cents."""

    description: str
    quantity: int
    unit_price_cents: int

    @property
    def amount_cents(self) -> int:
        """Quantity times unit price."""
        return self.quantity * self.unit_price_cents


@dataclass(frozen=True)
class Order:
    """One order, owned by exactly one customer."""

    order_id: str
    customer_id: str
    placed_on: str
    status: str
    lines: tuple[LineItem, ...]

    @property
    def total_cents(self) -> int:
        """The sum of the lines."""
        return sum(line.amount_cents for line in self.lines)


class OrderStore:
    """Read-only lookups over the fixture data."""

    def __init__(self, customers: list[Customer], orders: list[Order]) -> None:
        self._customers = {c.customer_id: c for c in customers}
        self._orders = {o.order_id: o for o in orders}
        if len(self._customers) != len(customers):
            raise StoreError("Two customers share a customer_id.")
        if len(self._orders) != len(orders):
            raise StoreError("Two orders share an order_id.")
        for order in orders:
            if order.customer_id not in self._customers:
                raise StoreError(
                    f"Order {order.order_id} names unknown customer "
                    f"{order.customer_id}."
                )

    def customer(self, customer_id: str) -> Customer | None:
        """The customer with this id, if there is one."""
        return self._customers.get(customer_id)

    def find_for(self, customer_id: str, order_id: str) -> Order | None:
        """The order, only if it belongs to this customer. The scoped lookup."""
        order = self._orders.get(order_id)
        if order is None or order.customer_id != customer_id:
            return None
        return order

    def exists_anywhere(self, order_id: str) -> bool:
        """Whether any account has this order. For the audit log, not the caller."""
        return order_id in self._orders


def load_store(path: Path = DEFAULT_ORDERS) -> OrderStore:
    """Read and check the fixture file."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StoreError(f"Cannot read {path.name}: {exc}") from exc
    if not isinstance(data, dict):
        raise StoreError(f"{path.name} must hold a JSON object.")
    customers = [_customer(item) for item in _list(data, "customers")]
    orders = [_order(item) for item in _list(data, "orders")]
    return OrderStore(customers, orders)


def _list(data: dict[str, object], key: str) -> list[object]:
    value = data.get(key)
    if not isinstance(value, list) or not value:
        raise StoreError(f"'{key}' must be a non-empty list.")
    return value


def _object(item: object, what: str) -> dict[str, object]:
    if not isinstance(item, dict):
        raise StoreError(f"Each {what} must be an object.")
    return item


def _text(item: dict[str, object], key: str) -> str:
    value = item.get(key)
    if not isinstance(value, str) or not value:
        raise StoreError(f"'{key}' must be non-empty text.")
    return value


def _whole(item: dict[str, object], key: str) -> int:
    value = item.get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise StoreError(f"'{key}' must be a whole number of 1 or more.")
    return value


def _customer(raw: object) -> Customer:
    item = _object(raw, "customer")
    return Customer(_text(item, "customer_id"), _text(item, "name"))


def _order(raw: object) -> Order:
    item = _object(raw, "order")
    status = _text(item, "status")
    if status not in ORDER_STATUSES:
        raise StoreError(f"Unknown order status {status!r}.")
    lines = tuple(_line(line) for line in _list(item, "lines"))
    return Order(
        order_id=_text(item, "order_id"),
        customer_id=_text(item, "customer_id"),
        placed_on=_text(item, "placed_on"),
        status=status,
        lines=lines,
    )


def _line(raw: object) -> LineItem:
    item = _object(raw, "line")
    return LineItem(
        description=_text(item, "description"),
        quantity=_whole(item, "quantity"),
        unit_price_cents=_whole(item, "unit_price_cents"),
    )
