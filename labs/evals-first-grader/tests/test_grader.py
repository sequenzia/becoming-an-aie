"""The shipped first grader: what it extracts, what it flags, what it misses.

If you rewrite grader.py for your own category, these tests describe the
shipped grader. Change or replace them with tests for yours.
"""

import pytest

from grader import CATEGORY, claims, grade
from records import Output, load_outputs

FACTS = {"Today": "2026-10-08", "Renewal date": "2026-11-03", "Price": "$49.00"}


def output(reply: str, customer: str = "When do we renew?") -> Output:
    return Output(id="T1", customer=customer, facts=FACTS, reply=reply)


@pytest.mark.parametrize(
    ("text", "keys"),
    [
        ("on 2026-11-03", ["date:11-03"]),
        ("on November 3, 2026", ["date:11-03"]),
        ("on Nov. 3rd", ["date:11-03"]),
        ("on the 3rd of November", ["date:11-03"]),
        ("by Friday", ["weekday:friday"]),
        ("for $2,880.00", ["usd:288000"]),
        ("for $49", ["usd:4900"]),
        ("$12.5 a seat", ["usd:1250"]),
        ("5,000 rows, 20 MB, weekdays, it may be in spam", []),
    ],
)
def test_claims_are_found_and_normalized(text: str, keys: list[str]) -> None:
    assert [claim.key for claim in claims(text)] == keys


def test_a_repeated_claim_is_listed_once() -> None:
    found = claims("November 3. Yes, 2026-11-03.")
    assert [claim.text for claim in found] == ["November 3"]


def test_a_date_from_the_facts_in_another_format_passes() -> None:
    assert grade(output("You renew on November 3 for $49.")).passed


def test_an_invented_date_fails_with_a_reason() -> None:
    verdict = grade(output("You renew on November 13 for $49.00."))
    assert not verdict.passed
    assert verdict.reason.startswith("states November 13")


def test_the_customer_message_counts_as_known() -> None:
    reply = "You can export it each Monday."
    assert not grade(output(reply)).passed
    assert grade(output(reply, customer="Can we export every Monday?")).passed


def test_a_reply_with_no_claims_passes() -> None:
    assert grade(output("Go to Settings, then Billing.")).passed


def test_on_the_fixture_it_flags_the_planned_seven() -> None:
    flagged = sorted(o.id for o in load_outputs() if not grade(o).passed)
    assert flagged == ["R02", "R06", "R10", "R13", "R16", "R19", "R22"]


def test_it_targets_the_reference_category() -> None:
    assert CATEGORY == "invented-facts"
