/**
 * Performance smoke tests. Runs during `bun test` to catch regressions.
 *
 * Each benchmark runs 5 times and uses the best time to eliminate JIT warmup
 * noise. Asserts exact cycle count match and that timing is within 20% of
 * the baseline best.
 */
import { describe, test, expect } from 'bun:test';

import {
  KERNEL_MAX_CYCLES,
  QLL_BENCHMARKS,
  compileBench,
  runBenchmark,
  runKernelBenchmark,
  runBestOf,
  loadBaseline,
  type BaselineEntry,
} from './bench';

const TIMING_THRESHOLD = 1.2;

function formatMHz(cycles: number, ms: number): string {
  return (cycles / (ms / 1000) / 1_000_000).toFixed(2);
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
  const baseline = loadBaseline();

  if (!baseline) {
    console.log('[bench] No bench.json found. Run `bun run bench:update` to create one.');
  }

  for (const name of QLL_BENCHMARKS) {
    test(name, async () => {
      const binary = compileBench(name);
      const best = await runBestOf(() => runBenchmark(binary));

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
    const best = await runBestOf(() => runKernelBenchmark(KERNEL_MAX_CYCLES));

    console.log(
      `[bench] kernel-boot: ${best.cycles.toLocaleString()} cycles, ` +
      `${best.timeMs.toFixed(1)}ms (${formatMHz(best.cycles, best.timeMs)} MHz)`
    );

    if (baseline?.benchmarks['kernel-boot']) {
      expect(best.cycles).toBe(baseline.benchmarks['kernel-boot'].cycles);
      assertTiming(best.timeMs, baseline.benchmarks['kernel-boot'], 'kernel-boot');
    }
  });
});
