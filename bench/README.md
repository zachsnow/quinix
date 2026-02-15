# Benchmarks

Performance smoke tests for the Quinix VM. Integrated into `bun test` to catch regressions.

## Files

| File | Purpose |
|------|---------|
| `compute.qll` | Arithmetic-intensive benchmark (nested loops with multiply/add) |
| `memory.qll` | Memory-intensive benchmark (array fill + sum with load/store) |
| `baseline.ts` | Native ceiling measurement (how fast can JS iterate + yield?) |
| `runner.ts` | Shared benchmark runner used by tests and update script |
| `bench.test.ts` | Smoke test that runs during `bun test` |
| `update-baseline.ts` | Regenerates `baseline.json` |
| `baseline.json` | Committed baseline with expected cycle counts and median timings |

## Usage

Run benchmarks as part of the test suite:

```bash
bun test
```

Update the baseline after intentional VM or codegen changes:

```bash
bun run bench:update
```

Compare VM performance against the native JS ceiling:

```bash
bun run bench/baseline.ts
```

## How it works

QLL benchmark cycle counts are **deterministic** for a given binary — if the compiler or VM changes instruction counts, the test fails. Run `bench:update` to accept the new counts.

The kernel benchmark boots the OS with a cycle limit. Timer interrupts introduce minor non-determinism, so only timing is reported (no exact cycle assertion).
