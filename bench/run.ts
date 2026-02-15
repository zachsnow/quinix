#!/usr/bin/env bun
/**
 * Run all VM benchmarks and compare against the stored baseline.
 */
import {
  compileBench,
  runBenchmark,
  runKernelBenchmark,
  loadCommittedBaseline,
  type Baseline,
  type BenchResult,
  type BaselineEntry,
} from './runner';

const KERNEL_MAX_CYCLES = 5_000_000;
const QLL_BENCHMARKS = ['compute', 'memory'] as const;

function formatMHz(cycles: number, ms: number): string {
  return (cycles / (ms / 1000) / 1_000_000).toFixed(2);
}

function formatPct(current: number, baseline: number): string {
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function printResult(name: string, result: BenchResult, entry: BaselineEntry | undefined) {
  console.log(`--- ${name} ---`);
  console.log(`  ${result.cycles.toLocaleString()} cycles  ${result.timeMs.toFixed(1)}ms  ${formatMHz(result.cycles, result.timeMs)} MHz`);

  if (entry) {
    console.log(`  baseline: ${entry.cycles.toLocaleString()} cycles  ${entry.medianMs}ms`);

    if (result.cycles !== entry.cycles) {
      const delta = result.cycles - entry.cycles;
      const sign = delta > 0 ? '+' : '';
      console.log(`  cycles: CHANGED ${sign}${delta.toLocaleString()} (${formatPct(result.cycles, entry.cycles)})`);
    } else {
      console.log(`  cycles: match`);
    }

    console.log(`  timing: ${formatPct(result.timeMs, entry.medianMs)}`);
  }
  console.log();
}

async function main() {
  const baseline: Baseline | null = loadCommittedBaseline();
  if (!baseline) {
    console.log('No committed bench.json found. Run `bun run bench:update` and commit.\n');
  }

  for (const name of QLL_BENCHMARKS) {
    const binary = compileBench(name);
    const result = await runBenchmark(binary);
    printResult(name, result, baseline?.benchmarks[name]);
  }

  const kernelResult = await runKernelBenchmark(KERNEL_MAX_CYCLES);
  printResult('kernel-boot', kernelResult, baseline?.benchmarks['kernel-boot']);

  process.stdin.destroy();
}

main().catch((e) => {
  console.error(e);
  throw e;
});
