---
title: Load test of a self-hosted model across input lengths, concurrency, and precision
origin: synthetic
kind: table
tool: none
checkedOn: 2026-10-09
summary: A synthetic load test of a fictional open-weights model on a fictional accelerator, with latency percentiles, throughput, KV cache use, and a quality check per precision. Written for this elective. Not a measured result.
---

This load test is synthetic. corvid-13b is a fictional open-weights model, the G-80 is a fictional accelerator, the support assistant is fictional, and every number is invented. The format follows what a team keeps after load-testing a serving configuration: the conditions first, then the results, then the quality check that says whether the fast configuration still does the job.

```yaml
test: support-assistant-serving-2026-10-06
model: corvid-13b              # fictional open weights, 13 billion parameters
hardware: one G-80 per row       # fictional accelerator: 80 GB memory, about 2 TB/s memory bandwidth
server: continuous batching, chunked prefill on, prefix cache off for this test
weights_memory: { bf16: 26 GB, int8: 13 GB, int4: 7 GB }
precision_notes:
  bf16: 16-bit weights and activations, the configuration the quality suite was built on
  int8: 8-bit weights and 8-bit activations
  int4: 4-bit weights, 16-bit activations (weight-only)
kv_cache_per_token: 192 KiB at 16-bit   # 48 layers, 8 KV heads, head size 128
kv_cache_pool: { bf16: "about 40 GB, about 200,000 tokens", int8: "about 53 GB, about 270,000 tokens", int4: "about 58 GB, about 295,000 tokens" }
load: closed loop, N simulated users, each sends its next request when the last one finishes, no think time
duration: 10 minutes per row after a 2-minute warm-up
latency_measured_at: the server, so network time to the user is not included
requirement:
  ttft_p95_seconds: "<= 1.5"
  tpot_p95_ms: "<= 60"
  quality: "overall >= 90% and refund policy >= 90% on serving-quality v2"
production_workload:          # from 7 days of gateway logs
  input_tokens: { p50: 2400, p95: 6100, p99: 11800 }
  output_tokens: { p50: 210, p95: 620 }
  peak_in_flight_requests: 24  # 2.9 requests per second at peak, about 8 seconds each
```

TTFT is time to first token. TPOT is time per output token after the first. E2E is end-to-end latency for the whole response. Throughput is output tokens per second across all users on the accelerator. Preemptions count requests the server paused and restarted because the KV cache was full.

**Part A. Fixed lengths: 1,000 input tokens, 300 output tokens, bf16.**

| Concurrency | TTFT p50 | TTFT p95 | TPOT p50 | TPOT p95 | E2E p95 | Throughput | KV cache use, peak | Preemptions per 1,000 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.09 s | 0.11 s | 14 ms | 15 ms | 4.6 s | 70 tok/s | 1% | 0 |
| 8 | 0.12 s | 0.31 s | 16 ms | 19 ms | 6.0 s | 480 tok/s | 5% | 0 |
| 32 | 0.18 s | 0.95 s | 22 ms | 31 ms | 10.3 s | 1,390 tok/s | 20% | 0 |
| 64 | 0.26 s | 2.1 s | 30 ms | 52 ms | 17.7 s | 2,050 tok/s | 41% | 0 |
| 128 | 0.41 s | 4.8 s | 45 ms | 96 ms | 33.6 s | 2,700 tok/s | 82% | 0 |

**Part B. Fixed lengths: 6,000 input tokens, 300 output tokens, bf16.**

| Concurrency | TTFT p50 | TTFT p95 | TPOT p50 | TPOT p95 | E2E p95 | Throughput | KV cache use, peak | Preemptions per 1,000 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.42 s | 0.46 s | 15 ms | 16 ms | 5.3 s | 66 tok/s | 3% | 0 |
| 8 | 0.61 s | 1.9 s | 19 ms | 34 ms | 12.1 s | 400 tok/s | 25% | 0 |
| 16 | 0.90 s | 3.4 s | 24 ms | 55 ms | 19.9 s | 640 tok/s | 50% | 0 |
| 32 | 1.4 s | 6.8 s | 31 ms | 88 ms | 33.2 s | 980 tok/s | 99% | 41 |

**Part C. Production mix: input and output lengths sampled from the gateway logs, three precisions.**

| Precision | Concurrency | TTFT p50 | TTFT p95 | TPOT p50 | TPOT p95 | Throughput | KV cache use, p95 | Preemptions per 1,000 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| bf16 | 8 | 0.31 s | 0.9 s | 19 ms | 38 ms | 410 tok/s | 21% | 0 |
| bf16 | 16 | 0.42 s | 1.4 s | 23 ms | 52 ms | 690 tok/s | 44% | 0 |
| bf16 | 24 | 0.63 s | 2.6 s | 29 ms | 71 ms | 860 tok/s | 62% | 0 |
| bf16 | 32 | 0.95 s | 4.1 s | 36 ms | 94 ms | 1,050 tok/s | 83% | 3 |
| int8 | 8 | 0.27 s | 0.7 s | 14 ms | 29 ms | 540 tok/s | 15% | 0 |
| int8 | 16 | 0.35 s | 1.0 s | 17 ms | 40 ms | 920 tok/s | 33% | 0 |
| int8 | 24 | 0.48 s | 1.4 s | 21 ms | 55 ms | 1,170 tok/s | 47% | 0 |
| int8 | 32 | 0.74 s | 2.5 s | 27 ms | 74 ms | 1,380 tok/s | 63% | 0 |
| int4 | 8 | 0.30 s | 0.8 s | 11 ms | 22 ms | 600 tok/s | 14% | 0 |
| int4 | 16 | 0.41 s | 1.3 s | 13 ms | 30 ms | 1,010 tok/s | 30% | 0 |
| int4 | 24 | 0.60 s | 2.1 s | 16 ms | 41 ms | 1,260 tok/s | 44% | 0 |
| int4 | 32 | 0.88 s | 3.3 s | 20 ms | 58 ms | 1,500 tok/s | 59% | 0 |

**Quality check: serving-quality v2, 400 cases sampled from production logs, three runs per precision.**

| Precision | Overall | Refund policy (70 cases) | Long inputs, over 8,000 tokens (60 cases) | Run-to-run range, overall |
|---|---:|---:|---:|---:|
| bf16 | 91.6% | 93% (65/70) | 88% (53/60) | 1.0 pt |
| int8 | 91.2% | 92% (64/70) | 87% (52/60) | 1.0 pt |
| int4 | 89.4% | 81% (57/70) | 78% (47/60) | 1.1 pt |

Notes recorded with the run:

- In Part C, a request's latency includes time spent waiting for a slot in the batch. Part A and Part B started every user at the same moment, so the first seconds of each row are a burst.
- One case in the refund category is about 1.4 points. One case in the long-input category is about 1.7 points.
- The accelerators are rented at $2.40 per hour each. Loading the model onto a fresh accelerator takes about 7 minutes.
- The gateway adds a median of 40 ms of network time on top of the server-side numbers.
