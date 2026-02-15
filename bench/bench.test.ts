/**
 * Performance smoke tests. Runs during `bun test` to catch regressions.
 *
 * If bench/bench.json exists, QLL benchmarks assert exact cycle count match
 * (cycle counts are deterministic for a given binary) and that wall-clock
 * time hasn't regressed beyond a threshold.
 *
 * Each benchmark runs 5 times (matching bench:update methodology) and uses
 * the best time to eliminate JIT warmup noise. The threshold is compared
 * against the baseline median.
 *
 * If no baseline exists, tests pass but log a suggestion to run `bun run bench:update`.
 */
import { describe, test, expect } from 'bun:test';

import {
  compileBench,
  runBenchmark,
  runKernelBenchmark,
  loadBaseline,
  type Baseline,
  type BaselineEntry,
  type BenchResult,
} from './runner';

const KERNEL_MAX_CYCLES = 5_000_000;
const BENCH_RUNS = 5;

// Fail if best time exceeds baseline median by more than 20%.
const TIMING_THRESHOLD = 1.2;

const QLL_BENCHMARKS = ['compute', 'memory'] as const;

function formatMHz(cycles: number, ms: number): string {
  return (cycles / (ms / 1000) / 1_000_000).toFixed(2);
}

function bestOf(results: BenchResult[]): BenchResult {
  return results.reduce((a, b) => a.timeMs < b.timeMs ? a : b);
}

function assertTiming(timeMs: number, entry: BaselineEntry, name: string) {
  const ratio = timeMs / entry.bestMs;
  if (ratio > TIMING_THRESHOLD) {
    throw new Error(
      `${name} perf regression: ${timeMs.toFixed(1)}ms is ${((ratio - 1) * 100).toFixed(0)}% slower than baseline ${entry.bestMs}ms (threshold: ${((TIMING_THRESHOLD - 1) * 100).toFixed(0)}%)`
    );
  }
}

describe('benchmarks', () => {
  const baseline: Baseline | null = loadBaseline();

  if (!baseline) {
    console.log('[bench] No bench.json found. Run `bun run bench:update` to create one.');
  }

  for (const name of QLL_BENCHMARKS) {
    test(name, async () => {
      const binary = compileBench(name);

      const results: BenchResult[] = [];
      for (let i = 0; i < BENCH_RUNS; i++) {
        results.push(await runBenchmark(binary));
      }
      const best = bestOf(results);

      console.log(
        `[bench] ${name}: ${best.cycles.toLocaleString()} cycles, ` +
        `${best.timeMs.toFixed(1)}ms (${formatMHz(best.cycles, best.timeMs)} MHz)`
      );

      if (baseline?.benchmarks[name]) {
        expect(best.cycles).toBe(baseline.benchmarks[name].cycles);
        assertTiming(best.timeMs, baseline.benchmarks[name], name);
      }
    });
  }

  test('kernel-boot', async () => {
    const results: BenchResult[] = [];
    for (let i = 0; i < BENCH_RUNS; i++) {
      results.push(await runKernelBenchmark(KERNEL_MAX_CYCLES));
    }
    const best = bestOf(results);

    console.log(
      `[bench] kernel-boot: ${best.cycles.toLocaleString()} cycles, ` +
      `${best.timeMs.toFixed(1)}ms (${formatMHz(best.cycles, best.timeMs)} MHz)`
    );

    // No exact cycle assertion — timer interrupts cause non-determinism.
    expect(best.cycles).toBeGreaterThan(0);
    if (baseline?.benchmarks['kernel-boot']) {
      assertTiming(best.timeMs, baseline.benchmarks['kernel-boot'], 'kernel-boot');
    }
  });
});
