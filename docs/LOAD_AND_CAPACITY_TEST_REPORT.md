# ArchMind Load and Capacity Test Report

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Current evidence

Status: Implemented but unverified

This pass verified correctness-oriented tests, not capacity. No public-release load test is complete yet.

Observed local timings from previous work:

- Warm assistant packaging reached approximately 33.9 seconds.
- Next dev cold route compilation was slow on Windows in earlier logs, including a first dashboard compile over 18 seconds.

## Required benchmarks

| Benchmark | Status | Required measurement |
|---|---:|---|
| API authenticated request throughput | Not implemented | p50/p95/p99 latency, error rate, CPU/memory. |
| PostgreSQL pool capacity | Not implemented | pool saturation, slow queries, lock waits, connection refusal behavior. |
| Redis/BullMQ worker capacity | Not implemented | job throughput, retry behavior, idempotency under duplicates. |
| Web production cold start | Not implemented | production server start and first-request timings. |

## User-wait-time guidance

Do not advertise a 30-60 second install experience until the measured total time supports it:


If the 284 MB artifact remains, estimated download time must be reported honestly at common bandwidths.
