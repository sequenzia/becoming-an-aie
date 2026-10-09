---
title: Tokenization and next-token trace, a support assistant
origin: synthetic
kind: trace
tool: acme-tok-2 (fictional tokenizer)
checkedOn: 2026-10-09
summary: A synthetic trace of one support request, written for the Foundations module. The tokenizer, model, token counts, and probabilities are invented to show the mechanisms. Not a measured result from any real model.
---

This trace is synthetic. It follows one request through a fictional support assistant: how the text becomes tokens, what the model's next-token distribution looks like at one step, and how the request spends its context window. The vendor, the tokenizer, and every number are invented. The shapes follow what real byte-level subword tokenizers and real sampling procedures do, so the patterns are the ones you will meet in practice. Real tokenizers split the same strings differently.

Part 1. Six strings through the tokenizer. Each token is shown in quotes. A leading space belongs to the token that follows it.

```text
tokenizer      acme-tok-2 (synthetic, byte-level BPE, 100,000-entry vocabulary)

string                              chars  count  pieces
"Where is my refund?"                  19      5  "Where" " is" " my" " refund" "?"
"where is my REFUND???"                21      6  "where" " is" " my" " REF" "UND" "???"
"Refund order #A-77120"                21      8  "Ref" "und" " order" " #" "A" "-" "771" "20"
"Wo ist meine Rückerstattung?"         28      9  "Wo" " ist" " meine" " R" "ück" "er" "statt" "ung" "?"
"1,234,567"                             9      5  "1" "," "234" "," "567"
"1234567"                               7      3  "123" "456" "7"
```

The same request as the structured payload the harness sends to the order tool:

```json
{"order_id": "A-77120", "action": "refund_status", "locale": "en-US"}
```

```text
characters  69
count       24   (quotes, braces, colons, and the underscore names each cost tokens)
```

Part 2. One decoding step. The assembled context ends with the assistant's partial answer. The refund policy passage was retrieved but placed seventh of twelve passages (see Part 3). The model must choose the next token.

```text
context tail   "...Thanks for your patience. Refunds are usually processed within"

candidate   T=0.5   T=1.0   T=1.5
" 5"        0.609   0.380   0.283
" 3"        0.274   0.255   0.216
" 7"        0.067   0.127   0.136
" 14"       0.020   0.069   0.091
" 10"       0.014   0.057   0.080
" two"      0.004   0.031   0.053
" the"      0.002   0.019   0.038
" 30"       0.001   0.015   0.033
all others  0.009   0.047   0.070

nucleus, top_p 0.9 at T=1.0   " 5" " 3" " 7" " 14" " 10" " two"   cumulative 0.919
```

Five independent completions of the same request at T=1.0, same context, same model:

```text
run 1   "...processed within 5 to 7 business days."
run 2   "...processed within 3 to 5 business days."
run 3   "...processed within 5 business days."
run 4   "...processed within 7 to 10 business days."
run 5   "...processed within 3 to 5 business days."
```

The policy passage in the knowledge base reads: "Refunds are issued to the original payment method within 7 to 10 business days of approval."

Part 3. How the request spends its context window.

```text
model                      acme-large-2 (synthetic)
context window             200,000 tokens (input, output, and reasoning combined)

segment                    position (tokens)     count
system prompt              0 to 2,139            2,140
tool definitions (14)      2,140 to 6,019        3,880
retrieved passages (12)    6,020 to 28,819      22,800
  passage 7, refund policy 17,420 to 19,318      1,899
conversation history       28,820 to 90,119     61,300
latest user message        90,120 to 90,165         46
reserved for output        (not in input)        16,000   (includes reasoning tokens)
total budgeted                                  106,166
```

Three places to look: how token counts differ from character and word counts, where the five completions came from in the Part 2 distribution, and where the one passage that held the right answer sits in Part 3.
