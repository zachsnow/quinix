# Benchmarks

Performance smoke tests for the Quinix VM. Integrated into `bun test` to catch regressions.

## Files

| File | Purpose |
|------|---------|
| `compute.qll` | Arithmetic-intensive benchmark (nested loops with multiply/add) |
| `memory.qll` | Memory-intensive benchmark (array fill + sum with load/store) |
| `bench.ts` | Benchmark runner, CLI (`bench` and `bench --update`), exports for tests |
| `bench.test.ts` | Smoke test that runs during `bun test` |
| `baseline.ts` | Native ceiling measurement (how fast can JS iterate + yield?) |
| `bench.json` | Committed baseline with expected cycle counts and best timings |

## Usage

Run benchmarks and diff against committed baseline:

```bash
bun run bench
```

Update the baseline after intentional VM or codegen changes:

```bash
bun run bench:update
```

Compare VM performance against the native JS ceiling:

```bash
bun run bench:baseline
```

## How it works

QLL benchmark cycle counts are **deterministic** for a given binary — if the compiler or VM changes instruction counts, the test fails. Run `bench:update` to accept the new counts.

Wall-clock timing is checked against the baseline best (best-of-5 runs). Tests fail if timing regresses by more than 20%.

The kernel benchmark boots the OS with a disk image and cycle limit. Timer interrupts introduce minor non-determinism, so no exact cycle assertion is made.
