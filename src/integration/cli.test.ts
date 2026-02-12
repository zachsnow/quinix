/**
 * CLI smoke tests.
 * Verifies the CLI tools (qllc, qasm, qvm) work end-to-end.
 */

import fs from 'fs';
import path from 'path';
import { $ } from 'bun';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(ROOT_DIR, '.test-tmp');

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function tmpFile(name: string): string {
  return path.join(TMP_DIR, name);
}

describe('qllc', () => {
  test('compiles a simple QLL file to QASM', async () => {
    const input = tmpFile('simple.qll');
    const output = tmpFile('simple.qasm');
    fs.writeFileSync(input, 'function main(): byte { return 42; }');

    const result = await $`bun run ${path.join(ROOT_DIR, 'bin/qllc.ts')} -o ${output} ${input}`.quiet().nothrow();
    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(output)).toBe(true);

    const qasm = fs.readFileSync(output, 'utf-8');
    expect(qasm).toContain('halt');
  });

  test('reports type errors', async () => {
    const input = tmpFile('error.qll');
    fs.writeFileSync(input, 'function main(): byte { return "not a byte"; }');

    const result = await $`bun run ${path.join(ROOT_DIR, 'bin/qllc.ts')} -o ${tmpFile('error.qasm')} --target=none ${input}`.quiet().nothrow();
    expect(result.exitCode).not.toBe(0);
  });
});

describe('qasm', () => {
  test('assembles a simple QASM file to binary', async () => {
    const input = tmpFile('simple.qasm');
    const output = tmpFile('simple.qbin');
    fs.writeFileSync(input, 'constant r0 0x0000002a\nhalt\n');

    const result = await $`bun run ${path.join(ROOT_DIR, 'bin/qasm.ts')} -o ${output} --target=none ${input}`.quiet().nothrow();
    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(output)).toBe(true);

    const stat = fs.statSync(output);
    expect(stat.size).toBeGreaterThan(0);
  });
});

describe('qvm', () => {
  test('runs a binary and exits with program return value', async () => {
    const qasmInput = tmpFile('exit0.qasm');
    const qbinOutput = tmpFile('exit0.qbin');
    fs.writeFileSync(qasmInput, 'halt\n');

    await $`bun run ${path.join(ROOT_DIR, 'bin/qasm.ts')} -o ${qbinOutput} --target=none ${qasmInput}`.quiet().nothrow();

    const result = await $`bun run ${path.join(ROOT_DIR, 'bin/qvm.ts')} ${qbinOutput}`.quiet().nothrow();
    expect(result.exitCode).toBe(0);
  });
});

describe('qllc + qasm + qvm pipeline', () => {
  test('compiles, assembles, and runs a QLL program', async () => {
    const qllInput = tmpFile('pipeline.qll');
    const qasmOutput = tmpFile('pipeline.qasm');
    const qbinOutput = tmpFile('pipeline.qbin');

    fs.writeFileSync(qllInput, 'function main(): byte { return 0; }');

    // Compile (--target=none to avoid slow auto-includes)
    const compileResult = await $`bun run ${path.join(ROOT_DIR, 'bin/qllc.ts')} --target=none -o ${qasmOutput} ${qllInput}`.quiet().nothrow();
    expect(compileResult.exitCode).toBe(0);

    // Assemble
    const asmResult = await $`bun run ${path.join(ROOT_DIR, 'bin/qasm.ts')} --target=none -o ${qbinOutput} ${qasmOutput}`.quiet().nothrow();
    expect(asmResult.exitCode).toBe(0);

    // Run
    const runResult = await $`bun run ${path.join(ROOT_DIR, 'bin/qvm.ts')} ${qbinOutput}`.quiet().nothrow();
    expect(runResult.exitCode).toBe(0);
  }, 15000);
});
