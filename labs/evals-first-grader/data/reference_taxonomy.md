# Failure taxonomy

One reviewer's taxonomy for the 30 outputs in data/outputs.jsonl, built from the notes in data/reference_labels.jsonl. It started as the lab's proposal. The reviewer renamed the groups, moved R26 out of "billing" and R24 out of "ungrouped", and wrote the definitions.

## invented-facts

Definition: The reply states a date, amount, status, or plan detail that the facts do not hold.

- R02: invents a fix date, October 15. Not in the facts, which say no fix date yet
- R06: wrong renewal date, November 13. The record says November 3, so it is not in the facts
- R10: wrong invoice amount, $480 instead of $440. Not in the facts
- R16: says it will be live by Friday. No date in the facts
- R18: says the bug is fixed. The facts say the fix is still in testing
- R22: wrong price, $15 instead of $24. Not in the facts

## promised-money

Definition: The reply grants or promises a refund, credit, or discount that only the billing or sales team can decide.

- R04: promises a service credit. Billing decides credits, should pass it on
- R14: promises a refund. Refunds are for billing to decide, should pass it on
- R24: promises a 20% discount. Discounts are for sales to decide

## missed-handoff

Definition: The customer asked for a person, reported a security problem, or asked for deletion, and the reply did not pass it on.

- R08: asked for a person and got no handoff
- R20: deletion request with no handoff to the privacy team, says to cancel instead

## wrong-question

Definition: The reply answers a different question from the one the customer asked.

- R12: answers a different question, Google sign-in instead of SAML. SAML needs Business
- R26: does not answer the question. They need access to the existing Billing group, not a new group
