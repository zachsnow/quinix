/**
 * Performance smoke tests. Runs during `bun test` to catch regressions.
 *
 * If bench/baseline.json exists, QLL benchmarks assert exact cycle count match
 * (cycle counts are deterministic for a given binary). The kernel benchmark
 * only reports timing since timer interrupts cause minor non-determinism.
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
} from './runner';

const KERNEL_MAX_CYCLES = 5_000_000;

const QLL_BENCHMARKS = ['compute', 'memory'] as const;

function formatMHz(cycles: number, ms: number): string {
  return (cycles / (ms / 1000) / 1_000_000).toFixed(2);
}

describe('benchmarks', () => {
  const baseline: Baseline | null = loadBaseline();

  if (!baseline) {
    console.log('[bench] No baseline.json found. Run `bun run bench:update` to create one.');
  }

  for (const name of QLL_BENCHMARKS) {
    test(name, async () => {
      const binary = compileBench(name);
      const result = await runBenchmark(binary);

      console.log(
        `[bench] ${name}: ${result.cycles.toLocaleString()} cycles, ` +
        `${result.timeMs.toFixed(1)}ms (${formatMHz(result.cycles, result.timeMs)} MHz)`
      );

      if (baseline?.benchmarks[name]) {
        expect(result.cycles).toBe(baseline.benchmarks[name].cycles);
      }
    });
  }

  test('kernel-boot', async () => {
    const result = await runKernelBenchmark(KERNEL_MAX_CYCLES);

    console.log(
      `[bench] kernel-boot: ${result.cycles.toLocaleString()} cycles, ` +
      `${result.timeMs.toFixed(1)}ms (${formatMHz(result.cycles, result.timeMs)} MHz)`
    );

    // No exact cycle assertion for kernel — timer interrupts cause non-determinism.
    // Just verify it ran a meaningful number of cycles.
    expect(result.cycles).toBeGreaterThan(0);
  });
});
