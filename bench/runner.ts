/**
 * Shared benchmark runner logic used by both bench.test.ts and update-baseline.ts.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { Memory } from '@/lib/types';
import { VM } from '@/vm/vm';
import { ClockPeripheral, Peripheral, TimerPeripheral } from '@/vm/peripherals';
import {
  BlockDevicePeripheral,
  DebugBreakPeripheral,
  DebugFilePeripheral,
  DebugInputPeripheral,
  DebugOutputPeripheral,
  FileBlockStorage,
} from '@/platform/server/peripherals';
import { SECTOR_SIZE_WORDS, sectorsFromFileSize } from '@/platform/server/qfs';
import { compileQLLToBinary } from '@/tests/helpers';

const BENCH_DIR = path.resolve(__dirname);
const KERNEL_BIN = path.resolve(__dirname, '..', 'kernel', 'kernel.qbin');
const DISK_IMAGE = path.resolve(__dirname, '..', 'image', 'disk.qfs');
const BASELINE_PATH = path.join(BENCH_DIR, 'baseline.json');

export interface BenchResult {
  cycles: number;
  timeMs: number;
}

export interface BaselineEntry {
  cycles: number;
  medianMs: number;
}

export interface Baseline {
  benchmarks: Record<string, BaselineEntry>;
}

/**
 * Compile a QLL benchmark file from bench/ to binary.
 */
export function compileBench(name: string): Uint32Array {
  const file = path.join(BENCH_DIR, `${name}.qll`);
  const source = fs.readFileSync(file, 'utf-8');
  const result = compileQLLToBinary(source, { filename: file });
  if (!result.success || !result.binary) {
    throw new Error(`Failed to compile ${name}: ${result.errors.join('\n')}`);
  }
  return result.binary;
}

/**
 * Run a compiled benchmark binary, returning cycle count and wall-clock time.
 */
export async function runBenchmark(binary: Uint32Array, maxCycles?: number): Promise<BenchResult> {
  const peripherals: Peripheral[] = [
    new TimerPeripheral(),
    new ClockPeripheral(),
    new DebugBreakPeripheral(),
    new DebugOutputPeripheral(),
  ];

  const vm = new VM({
    debug: false,
    peripherals,
    cycles: maxCycles,
  });

  const start = performance.now();
  await vm.run(binary);
  const end = performance.now();

  return {
    cycles: vm.stats.cycles,
    timeMs: end - start,
  };
}

/**
 * Run the kernel binary as a benchmark. The kernel boots, enters the shell,
 * and spins waiting for stdin — the cycle limit fires and throws, but
 * vm.stats.cycles is still readable after the throw.
 */
export async function runKernelBenchmark(maxCycles: number): Promise<BenchResult> {
  const kernelBytes = fs.readFileSync(KERNEL_BIN);
  const binary = Memory.fromBytes(new Uint8Array(kernelBytes));

  const stat = fs.statSync(DISK_IMAGE);
  const totalSectors = sectorsFromFileSize(stat.size);
  const storage = new FileBlockStorage(DISK_IMAGE, totalSectors, SECTOR_SIZE_WORDS);

  const peripherals: Peripheral[] = [
    new TimerPeripheral(),
    new ClockPeripheral(),
    new DebugBreakPeripheral(),
    new DebugOutputPeripheral(),
    new DebugInputPeripheral(),
    new DebugFilePeripheral(path.dirname(KERNEL_BIN)),
    new BlockDevicePeripheral(storage, SECTOR_SIZE_WORDS),
  ];

  const vm = new VM({
    debug: false,
    peripherals,
    cycles: maxCycles,
  });

  const start = performance.now();
  try {
    await vm.run(binary);
  } catch (e: any) {
    // Expected: "exceeded max cycles" when the kernel is waiting for input.
    if (!e.message?.includes('exceeded max cycles')) {
      throw e;
    }
  }
  const end = performance.now();

  // DebugInputPeripheral may have opened stdin; destroy so it doesn't hold the event loop.
  process.stdin.destroy();

  return {
    cycles: vm.stats.cycles,
    timeMs: end - start,
  };
}

export function loadBaseline(): Baseline | null {
  if (!fs.existsSync(BASELINE_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
}

/**
 * Load baseline.json from the last git commit (HEAD), ignoring uncommitted changes.
 */
export function loadCommittedBaseline(): Baseline | null {
  try {
    const json = execSync('git show HEAD:bench/baseline.json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function saveBaseline(baseline: Baseline): void {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
}
