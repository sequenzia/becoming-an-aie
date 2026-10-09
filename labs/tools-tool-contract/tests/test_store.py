"""The fixture data and its scoped lookup."""

import json
from pathlib import Path

import pytest

from store import StoreError, load_store

STORE = load_store()


def write(tmp_path: Path, data: object) -> Path:
    path = tmp_path / "orders.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def order(order_id: str, customer_id: str) -> dict[str, object]:
    return {
        "order_id": order_id,
        "customer_id": customer_id,
        "placed_on": "2026-09-01",
        "status": "paid",
        "lines": [{"description": "Seat", "quantity": 1, "unit_price_cents": 100}],
    }


CUSTOMERS = [{"customer_id": "cus_a", "name": "A"}]


def test_the_shipped_fixture_loads() -> None:
    customer = STORE.customer("cus_pellwick")
    assert customer is not None
    assert customer.name == "Pellwick Dental Group"


def test_totals_are_computed_from_the_lines() -> None:
    found = STORE.find_for("cus_pellwick", "ORD-10433")
    assert found is not None
    assert found.total_cents == 3 * 7400 + 30000


def test_the_scoped_lookup_returns_only_the_customers_own_orders() -> None:
    assert STORE.find_for("cus_tallgrass", "ORD-20877") is not None
    assert STORE.find_for("cus_pellwick", "ORD-20877") is None
    assert STORE.exists_anywhere("ORD-20877")
    assert not STORE.exists_anywhere("ORD-99999")


def test_an_order_for_an_unknown_customer_is_refused(tmp_path: Path) -> None:
    path = write(tmp_path, {"customers": CUSTOMERS, "orders": [order("O1", "x")]})
    with pytest.raises(StoreError, match="unknown customer"):
        load_store(path)


def test_duplicate_order_ids_are_refused(tmp_path: Path) -> None:
    orders = [order("O1", "cus_a"), order("O1", "cus_a")]
    path = write(tmp_path, {"customers": CUSTOMERS, "orders": orders})
    with pytest.raises(StoreError, match="share an order_id"):
        load_store(path)


def test_an_unknown_status_is_refused(tmp_path: Path) -> None:
    bad = order("O1", "cus_a") | {"status": "lost"}
    path = write(tmp_path, {"customers": CUSTOMERS, "orders": [bad]})
    with pytest.raises(StoreError, match="Unknown order status"):
        load_store(path)


def test_a_zero_quantity_is_refused(tmp_path: Path) -> None:
    bad = order("O1", "cus_a")
    bad["lines"] = [{"description": "Seat", "quantity": 0, "unit_price_cents": 100}]
    path = write(tmp_path, {"customers": CUSTOMERS, "orders": [bad]})
    with pytest.raises(StoreError, match="quantity"):
        load_store(path)


def test_a_file_that_is_not_json_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "orders.json"
    path.write_text("not json", encoding="utf-8")
    with pytest.raises(StoreError, match="Cannot read"):
        load_store(path)
