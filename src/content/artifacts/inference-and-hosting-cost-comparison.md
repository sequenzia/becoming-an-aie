---
title: Hosted API against self-hosted weights, monthly cost comparison
origin: synthetic
kind: table
tool: none
checkedOn: 2026-10-09
summary: A synthetic monthly cost comparison for a fictional support assistant, a hosted API against three self-hosted configurations, at today's volume and at three times it. Written for this elective. Not a measured result.
---

This comparison is synthetic. The vendor (acme), the model names, the accelerator (G-80), the prices, and every number are invented. It uses the same workload and the same fictional self-hosted model as the load test for this elective. The format follows what a team writes when it asks whether to keep paying per token or to run the weights itself.

```yaml
service: support-assistant
workload:                       # from 30 days of gateway logs
  requests_per_month: 3000000    # about 100,000 a day
  mean_input_tokens: 3000
  share_of_input_from_shared_prefix: 0.60   # system prompt and tool definitions, cacheable
  mean_output_tokens: 250
  peak_requests_per_second: 2.9  # weekdays 10:00 to 12:00
  overnight_requests_per_second: 0.3
  peak_in_flight_requests: 24
requirement:
  ttft_p95_seconds: "<= 1.5"
  tpot_p95_ms: "<= 60"
  quality: "overall >= 90% and refund policy >= 90% on serving-quality v2"
  data_handling: "tickets contain customer personal data; processing must stay in the EU region"
```

**Options compared.**

| Option | What runs | Quality, overall / refund | Capacity basis |
|---|---|---|---|
| H1 | acme-medium-20260601 through acme's hosted API, EU region, standard tier | 93.1% / 94%; long inputs not measured; one run, no run-to-run range | vendor rate limits: 4,000 requests, 2,000,000 uncached input tokens, and 400,000 output tokens per minute |
| S1 | corvid-13b, bf16, on rented G-80s in the team's own EU cloud account | 91.6% / 93% | 16 in-flight requests per accelerator within the requirement |
| S2 | corvid-13b, int8 | 91.2% / 92% | 24 in-flight requests per accelerator within the requirement |
| S3 | corvid-13b, int4 | 89.4% / 81% | 16 in-flight requests per accelerator within the requirement (TTFT-limited) |

**Hosted pricing for H1 (acme list prices on 2026-10-01).** Input $1.00 per million tokens. Cache reads $0.10 per million. Output $5.00 per million. Cache writes are rare for this workload and are left out.

**Monthly cost at today's volume, 3.0 million requests.**

| Line | H1 hosted | S1 bf16 | S2 int8 | S3 int4 |
|---|---:|---:|---:|---:|
| Uncached input, 1,200 tokens per request | $3,600 | | | |
| Cached input, 1,800 tokens per request | $540 | | | |
| Output, 250 tokens per request | $3,750 | | | |
| Accelerators, $2.40 per hour, 730 hours | | 3 = $5,256 | 2 = $3,504 | 3 = $5,256 |
| Platform and on-call engineering | 0.05 FTE = $900 | 0.3 FTE = $5,400 | 0.3 FTE = $5,400 | 0.3 FTE = $5,400 |
| Observability and storage | $100 | $400 | $400 | $400 |
| Eval runs on model or serving changes | $300 | $300 | $300 | $300 |
| **Total** | $9,190 | $11,356 | $9,604 | $11,356 |
| Per 1,000 requests | $3.06 | $3.79 | $3.20 | $3.79 |

Accelerator counts are peak in-flight requests divided by the per-accelerator capacity, rounded up, plus one spare so that losing an accelerator does not breach the requirement. The fleet runs all month, because loading the model onto a new accelerator takes about 7 minutes and the morning ramp is faster than that.

**Monthly cost at three times today's volume, 9.0 million requests, peak in-flight 72.**

| Line | H1 hosted | S2 int8 |
|---|---:|---:|
| Tokens | $23,670 | |
| Accelerators | | 4 = $7,008 |
| Engineering, observability, evals | $1,600 | $6,100 |
| **Total** | $25,270 | $13,108 |
| Per 1,000 requests | $2.81 | $1.46 |

Notes recorded with the comparison:

- Average load is about 1.2 requests per second. Two int8 accelerators can serve about 6 requests per second within the requirement, so the S2 fleet averages about 19% of its capacity over a month.
- H1's peak use is about 174 requests, 209,000 uncached input tokens, and 44,000 output tokens per minute. If the shared prefix stopped being cached, uncached input would rise to about 522,000 tokens per minute.
- acme-medium-20260601 has no announced retirement date. corvid-13b weights do not retire, but security patches to the serving stack and the driver are the team's job.
- A nightly summary job of 40,000 requests is not in these numbers. acme's batch endpoint prices it at half the standard rate, with results within 24 hours.
- The engineering line for the self-hosted options is an estimate by the platform lead. Nobody on the team has run this serving stack in production before.
