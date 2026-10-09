---
title: Invoice extraction, pipeline comparison
origin: synthetic
kind: eval-report
checkedOn: 2026-10-09
summary: A synthetic eval report for a fictional invoice-extraction feature. Three pipelines and a blind control on one case set, by capture condition, with silent errors, invented fields, and region tracing. Not a measured result.
---

This report is synthetic. The vendors (Paperline and orbis), the model ids, the case set, and every number are invented for the Multimodal systems workshop. The format follows what a team would keep after comparing extraction pipelines: the requirement first, then the case set, then the results.

```yaml
report: invoice-extraction-2026-10-05
feature: accounts-payable intake        # reads supplier invoices and posts them for payment
requirement:
  silent_critical_error_rate: "<= 1.0% of auto-accepted documents"
  invented_critical_values: "0 on auto-accepted documents"
  review_rate: "<= 10% of documents"
  latency_p95_seconds: "<= 20"
critical_fields: [supplier_vat_id, invoice_number, invoice_date, purchase_order, total, line qty, line unit_price]
case_set:
  name: ap-invoices
  version: 2
  documents: 300
  sampled_from: "90 days of received invoices, 60 suppliers, stratified by capture condition"
  labels: "every field keyed by two AP clerks from the original document; 41 of 9,212 field labels disagreed and were adjudicated"
  by_condition: { digital_pdf: 120, clean_scan: 80, phone_photo: 50, merged_or_wrapped_table: 30, handwritten_annotation: 20 }
  absent_po_number: "64 documents carry no purchase order number"
traffic_mix_last_30_days: { digital_pdf: 35%, clean_scan: 25%, phone_photo: 30%, merged_or_wrapped_table: 6%, handwritten_annotation: 4% }
grader: "field-level exact match against the adjudicated labels, after normalizing dates and number formats"
runs_per_configuration: 3
```

The pipelines:

- **P1, OCR then text.** Paperline OCR 4.2 returns words, boxes, and a confidence per word. orbis-text-small fills the schema from the OCR text. Regions come from the OCR word boxes.
- **P2, direct.** orbis-vision-large reads the page images and the PDF text layer together and fills the schema. Regions are boxes the model reports.
- **P3, hybrid.** P1 first. A document escalates to P2 when any critical field has OCR confidence below 0.90, when any arithmetic check fails, or when the capture classifier says phone photo. 18% of documents escalated.
- **Blind control.** orbis-vision-large with the page images removed, given only the PDF text layer.

Critical-field accuracy: the share of documents with every critical field correct, before any human review.

| Condition (cases) | P1 | P2 | P3 | Blind control |
|---|---:|---:|---:|---:|
| Digital PDF (120) | 97.5% | 98.3% | 98.3% | 96.7% |
| Clean scan (80) | 91.3% | 96.3% | 96.3% | 0% (no text layer) |
| Phone photo (50) | 72.0% | 90.0% | 88.0% | 0% (no text layer) |
| Merged or wrapped table (30) | 63.3% | 83.3% | 80.0% | 33.3% (12 of 30 have a text layer) |
| Handwritten annotation (20) | 55.0% | 80.0% | 80.0% | 0% (no text layer) |
| All 300 | 85.3% | 93.7% | 93.0% | n/a |

What reached accounts payable, and what a person saw first:

| Measure | P1 | P2 | P3 |
|---|---:|---:|---:|
| Documents flagged for review | 16% (48) | 7% (21) | 9% (27) |
| Silent critical errors: auto-accepted with a wrong critical field | 4 of 252 (1.6%) | 7 of 279 (2.5%) | 3 of 273 (1.1%) |
| Invented values per 1,000 extracted fields (value present, nothing in the document supports it) | 0.4 | 2.1 | 0.9 |
| Absent PO number returned as null (64 cases) | 61 (95.3%) | 52 (81.3%) | 59 (92.2%) |
| Region contains the extracted value (200 sampled fields) | 99.0% | 86.5% | 97.0% |
| p95 latency per document | 7 s | 26 s | 15 s (escalated: 33 s) |

Notes recorded with the run:

- Run-to-run range on overall critical-field accuracy across the three runs: 0.7 points for P1, 1.3 for P2, 1.0 for P3. Silent critical errors ranged from 4 to 5 for P1, 6 to 9 for P2, and 2 to 4 for P3.
- Of P2's 7 silent errors, 4 were purchase order numbers or VAT ids that do not appear on the document. Of P1's 4, 3 were line items with quantity and unit price exchanged, all on tables whose description column wraps.
- Of the 120 digital PDFs, the blind control got 116 right. P2 got 118 right.
- Phone photos are 17% of the case set and 30% of last month's traffic.
- The cost of each configuration is in the cost table that accompanies this report.
