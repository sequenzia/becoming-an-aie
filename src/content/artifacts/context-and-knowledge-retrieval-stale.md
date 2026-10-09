---
title: Retrieval result set for one question, with index metadata
origin: synthetic
kind: output-set
tool: cedar-harness
version: "2.3.0"
checkedOn: 2026-10-09
summary: A synthetic hybrid-retrieval result set for one support question, with revisions, index dates, and the eval label for the query. Written for this module. Not a measured result from any real system.
---

This result set is synthetic. It was written for the Context and knowledge module. The documents, the product, the tenants, the scores, and the eval case are invented. It is the retrieval step behind turn 14 of session s-7731, the same call the context manifest describes.

The question: "How do I rotate the SAML signing certificate without logging everyone out?" The application supplied the identity scope. The harness supplied the filters.

```json
{
  "name": "retrieval.search",
  "span_id": "r14",
  "parent_span_id": "s7731-t14",
  "attributes": {
    "retrieval.method": "hybrid",
    "retrieval.lexical": "bm25",
    "retrieval.dense.model": "acme-embed-3",
    "retrieval.fusion": "reciprocal_rank_fusion",
    "retrieval.top_k": 12,
    "retrieval.filters": {
      "tenant_scope": ["public", "tenant-alder"],
      "edition": null,
      "status": null
    },
    "retrieval.results_filtered_out": 1,
    "retrieval.filtered_out_reason": "tenant_scope: tenant-birch internal note",
    "kb.index.last_successful_sync": "2026-08-29T03:10:44Z",
    "kb.index.sync_job.status": "failing since 2026-08-30: 403 from source API, missing permission kb.read.revisions"
  }
}
```

The top eight of the twelve results, in fused rank order. "Source rev" is the latest revision in the documentation system today. "Index rev" is the revision the index holds.

| Rank | Doc | Index rev | Source rev | Title | Applies to | Indexed | BM25 rank | Dense rank | Cited |
|---:|---|---|---|---|---|---|---:|---:|---|
| 1 | KB-2207 | r3 | r3 | Rotate the SAML signing certificate | 8.x cloud | 2026-08-15 | 2 | 1 | Yes |
| 2 | KB-1180 | r5 | r6 | SAML certificate rotation for self-hosted 7.x | 7.x self-hosted | 2026-04-04 | 1 | 3 | Yes |
| 3 | KB-0932 | r2 | r2 | SSO troubleshooting: error SAML-417 | all | 2026-05-20 | 4 | 6 | No |
| 4 | RN-7.4.2 | r1 | r1 | Release notes, Cedar Teams 7.4.2 | 7.4 LTS | 2026-08-29 | 3 | 9 | No |
| 5 | FORUM-55812 | n/a | n/a | "cert rotation logged us all out" | unknown | 2026-07-02 | 7 | 2 | No |
| 6 | KB-2210 | r1 | r1 | Configure SCIM provisioning | 8.x cloud | 2026-06-11 | 12 | 4 | No |
| 7 | KB-1022 | r4 | r4 | Session timeout settings | all | 2026-03-30 | 9 | 5 | No |
| 8 | KB-0874 | r1 | archived | SSO setup for 6.x | 6.x | 2025-11-02 | 6 | 11 | No |

Excerpts of the passages that matter, as indexed:

```text
[KB-2207 r3, section 2] In the admin console, open Security, then SSO. Upload the
new certificate and select Activate. Cloud tenants receive the new metadata
automatically.

[KB-1180 r5, section 2] Rotation replaces the active certificate immediately.
All users must sign in again after activation. Schedule a maintenance window.

[RN-7.4.2, item 6] SAML: adds a dual-certificate overlap period so a new signing
certificate can be published before the old one is retired. See KB-1180.

[FORUM-55812] we rotated the cert on 7.3 and it logged everyone out, plan for it
```

The eval label for this query, from the retrieval set the team maintains:

```yaml
case: RET-0412
query_type: procedure, version-specific
scope: tenant-alder, edition 7.4.3 LTS self-hosted
relevant_passages:
  - KB-1180 r6 section 2   # "Publish the new certificate as secondary. Users stay signed in during the overlap."
acceptable_supporting:
  - RN-7.4.2 item 6
last_run: 2026-08-12   # before r6 was published
last_result: recall_at_5 = 1.0 against r5, the label at the time
```
