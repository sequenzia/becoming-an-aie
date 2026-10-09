---
title: Supplier invoice, source table and extraction
origin: synthetic
kind: output-set
checkedOn: 2026-10-09
summary: A synthetic scanned invoice table rendered in text, the extraction a fictional pipeline produced from it, and the validation log. Written for the Multimodal systems failure exercise. Not a measured result.
---

This artifact is synthetic. The supplier, the buyer, the pipeline, and every value are invented. The pipeline is the hybrid design from the workshop: a fictional OCR service reads the page, a fictional text model fills the extraction schema, and the application runs its checks before the invoice enters accounts payable.

The source is page 1 of a scanned supplier invoice. Below is the table region as a reviewer sees it on screen, rendered in text. The column x ranges, in pixels on the 1,240-pixel-wide page image, are from the layout step and are printed under the header.

```text
Halvard Supply GmbH                     Invoice no. HS-2026-11873
                                        Date 2026-09-28
Bill to: Fennick Facilities Ltd         Customer no. 30-5512

Pos  Item no.  Description                   Qty  Unit  Unit price EUR   Amount EUR
     [x 40-80] [x 85-160] [x 165-400]      [410-450][455-485] [490-560]  [565-640]
---------------------------------------------------------------------------------
1    HS-2210   Cable tray 2 m, galvanized     40   pc        7.25        290.00
2    HS-3104   Mounting bracket, L-type,       6   pk       18.00        108.00
               pack of 10
3    HS-0457   Conduit 25 mm, 3 m             12   pc        8.00         96.00
4    HS-7781   Junction box IP65              15   pc       11.40        171.00
5    HS-1290   Cable ties 300 mm, bag of 100   9   bg        4.60         41.40
---------------------------------------------------------------------------------
                                              Subtotal                   706.40
                                              VAT 19%                    134.22
                                              Total EUR                  840.62
```

The extraction, as the application received it. Each value carries the page and the region the pipeline says it read it from, as `[x_min, y_min, x_max, y_max]` in pixels on the same page image, and the OCR service's character confidence for that region.

```json
{
  "invoice_number": { "value": "HS-2026-11873", "page": 1, "region": [905, 88, 1060, 106], "ocr_conf": 0.99 },
  "invoice_date": { "value": "2026-09-28", "page": 1, "region": [905, 110, 1000, 128], "ocr_conf": 0.99 },
  "supplier_vat_id": { "value": "DE318840275", "page": 1, "region": [60, 1610, 210, 1628], "ocr_conf": 0.97 },
  "purchase_order": { "value": null, "page": null, "region": null, "ocr_conf": null },
  "lines": [
    { "pos": 1, "item": "HS-2210", "qty": 40, "unit": "pc", "unit_price": 7.25, "amount": 290.00,
      "regions": { "qty": [418, 402, 444, 420], "unit_price": [512, 402, 552, 420] }, "ocr_conf": 0.98 },
    { "pos": 2, "item": "HS-3104", "qty": 6, "unit": "pk", "unit_price": 18.00, "amount": 108.00,
      "regions": { "qty": [430, 428, 444, 446], "unit_price": [505, 428, 552, 446] }, "ocr_conf": 0.97 },
    { "pos": 3, "item": "HS-0457", "qty": 8, "unit": "pc", "unit_price": 12.00, "amount": 96.00,
      "regions": { "qty": [520, 478, 552, 496], "unit_price": [418, 478, 444, 496] }, "ocr_conf": 0.97 },
    { "pos": 4, "item": "HS-7781", "qty": 15, "unit": "pc", "unit_price": 11.40, "amount": 171.00,
      "regions": { "qty": [418, 504, 444, 522], "unit_price": [508, 504, 552, 522] }, "ocr_conf": 0.98 },
    { "pos": 5, "item": "HS-1290", "qty": 9, "unit": "bg", "unit_price": 4.60, "amount": 41.40,
      "regions": { "qty": [430, 530, 444, 548], "unit_price": [512, 530, 552, 548] }, "ocr_conf": 0.98 }
  ],
  "subtotal": 706.40,
  "vat_rate": 0.19,
  "vat_amount": 134.22,
  "total": 840.62,
  "currency": "EUR"
}
```

The validation log for this document:

```text
2026-09-29T07:14:02Z  doc=inv-2026-0929-0412  pipeline=hybrid-v3  route=ocr+text (no escalation)
  schema ............................ pass
  required fields present ........... pass
  line arithmetic qty x unit_price .. pass  (5 of 5 lines)
  sum(lines) == subtotal ............ pass  (706.40)
  subtotal x vat_rate == vat_amount . pass  (134.22)
  subtotal + vat == total ........... pass  (840.62)
  supplier_vat_id format and checksum pass
  supplier on vendor master ......... pass  (Halvard Supply GmbH)
  min ocr_conf on critical fields ... 0.97  (threshold 0.90) pass
  purchase order match .............. skipped (supplier on no-PO list)
  decision .......................... auto-accept, posted to accounts payable
```

The vendor master is the buyer's approved supplier list. The no-PO list holds suppliers exempted from purchase-order matching.

The invoice was posted. Receiving and inventory valuation read the line items from accounts payable.
