---
title: Invoice and voice-message pipelines, cost per item
origin: synthetic
kind: table
checkedOn: 2026-10-09
summary: A synthetic cost table for the fictional invoice-extraction and voice-message features, worked from tokens per page and per second of audio, with review cost beside model cost. Invented prices. Not a measured result.
---

This table is synthetic. The vendors, the prices, and the volumes are invented for the Multimodal systems workshop. The token arithmetic follows the documented shape of real APIs: images billed by fixed-size pixel patches, a PDF page sent as an image plus its extracted text, and audio billed per second. The fictional vendor's patch is 28 by 28 pixels, the same patch size Anthropic documents for Claude. The audio rate, 32 tokens per second, is the one Google documents for the Gemini API.

```yaml
volumes_per_month:
  invoices: 20000            # average 3 pages
  voice_messages: 4000       # average 90 seconds
prices:                      # invented
  paperline_ocr_4_2: "$1.50 per 1,000 pages"
  orbis_text_small: "$0.40 per million input tokens, $1.60 per million output tokens"
  orbis_vision_large: "$3.00 per million input tokens, $15.00 per million output tokens"
  parla_stt_2: "$0.005 per audio minute"
token_assumptions:
  page_image: "1092 x 1414 px, ceil(1092/28) x ceil(1414/28) = 39 x 51 = 1,989 tokens"
  page_image_downsampled: "784 x 1015 px, 28 x 37 = 1,036 tokens"
  page_text_layer: "900 tokens per invoice page (OCR text or PDF text layer)"
  extraction_prompt: "1,200 tokens including the schema"
  extraction_output: "400 tokens (text model), 500 tokens (vision model, which also returns regions)"
  audio_direct: "32 tokens per second, so 90 s = 2,880 tokens"
  voice_prompt: "800 tokens"
  voice_transcript: "about 300 tokens for 90 s of speech"
  voice_output: "250 tokens for a summary (A); 450 tokens for a summary plus the full transcript (B)"
review:
  cost_per_reviewed_invoice: "$0.90 (3 minutes of an AP clerk at $18 per hour)"
cost_basis: "model and service charges, plus review time on flagged documents; retries, storage, and the cost of silent errors are not included"
```

Invoices, per document and per month at 20,000 documents:

| Pipeline | Input tokens per document | Model and OCR cost | Review rate | Review cost | Cost per document | Per month |
|---|---:|---:|---:|---:|---:|---:|
| P1: OCR then orbis-text-small | 3,900 | $0.0067 | 16% | $0.1440 | $0.1507 | $3,014 |
| P2: orbis-vision-large, full-size pages | 9,867 | $0.0371 | 7% | $0.0630 | $0.1001 | $2,002 |
| P2 with downsampled pages | 7,008 | $0.0285 | not measured | not measured | not measured | not measured |
| P3: hybrid, 18% escalated to P2 | 3,900, plus 9,867 when escalated | $0.0134 | 9% | $0.0810 | $0.0944 | $1,888 |

How the P2 line is built: three pages at 1,989 image tokens and 900 text tokens each is 8,667 tokens, plus the 1,200-token prompt is 9,867 input tokens. At $3.00 per million that is $0.0296. Five hundred output tokens at $15.00 per million is $0.0075. The total is $0.0371.

Voice messages, per message and per month at 4,000 messages:

| Pipeline | What it returns | Cost per message | Per month |
|---|---|---:|---:|
| A: parla-stt-2, then orbis-text-small summary | Text, one confidence per chunk, no word timestamps | $0.0083 | $33 |
| B: audio sent directly to orbis-vision-large | Summary and a transcript the model writes; times only if the prompt asks | $0.0178 | $71 |

How the voice lines are built. A: 1.5 audio minutes at $0.005 is $0.0075. The summary call reads the 800-token prompt and the 300-token transcript, 1,100 tokens at $0.40 per million, $0.0004, and writes 250 tokens at $1.60 per million, $0.0004. The total is $0.0083. B: 2,880 audio tokens and the 800-token prompt are 3,680 input tokens at $3.00 per million, $0.0110. Four hundred fifty output tokens at $15.00 per million is $0.0068. The total is $0.0178.

Notes recorded with the table:

- Word timestamps are available from Parla only on parla-stt-1, which the vendor has announced for retirement. parla-stt-2 returns text without them.
- The P2 downsampled row has a token count but no accuracy measurement. The eval report ran full-size pages only.
- Review cost is the same for every flagged document whatever the reason it was flagged.
