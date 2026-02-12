/**
 * File-based QLL test runner.
 *
 * Discovers .qll files with directive comments and runs them as tests.
 * Directives (in comments at the top of the file):
 *   @expect: <number>       - expected return value (decimal or hex)
 *   @expect-error: <string> - expected compilation error substring
 *   @libs: alloc            - include allocator (for new/delete)
 *   @libs: std              - include standard library (includes alloc)
 *   @cycles: <number>       - VM cycle budget (default: 5000)
 *   @skip                   - skip this test
 *   @skip: <reason>         - skip with reason
 */

import fs from 'fs';
import path from 'path';

import { VM } from '@/vm/vm';
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { getStdLib, getBareEntrypoint, getAllocator } from '@test/helpers';

const ROOT_DIR = path.resolve(__dirname, '..', '..');

// === Directive parsing ===

interface TestDirectives {
  expect?: number;
  expectError?: string;
  libs: Set<string>;
  cycles: number;
  skip: boolean;
  skipReason?: string;
}

function parseDirectives(source: string): TestDirectives | null {
  const directives: TestDirectives = {
    libs: new Set(),
    cycles: 5000,
    skip: false,
  };

  let hasDirective = false;

  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('//')) {
      continue;
    }
    const comment = trimmed.slice(2).trim();

    const skipMatch = comment.match(/^@skip(?::\s*(.+))?$/);
    if (skipMatch) {
      directives.skip = true;
      directives.skipReason = skipMatch[1]?.trim();
      hasDirective = true;
      continue;
    }

    const expectMatch = comment.match(/^@expect:\s*(.+)$/);
    if (expectMatch) {
      const val = expectMatch[1].trim();
      directives.expect = val.startsWith('0x') ? parseInt(val, 16) : parseInt(val, 10);
      hasDirective = true;
      continue;
    }

    const expectErrorMatch = comment.match(/^@expect-error:\s*(.+)$/);
    if (expectErrorMatch) {
      directives.expectError = expectErrorMatch[1].trim();
      hasDirective = true;
      continue;
    }

    const libsMatch = comment.match(/^@libs:\s*(.+)$/);
    if (libsMatch) {
      for (const lib of libsMatch[1].split(',').map(s => s.trim())) {
        directives.libs.add(lib);
      }
      hasDirective = true;
      continue;
    }

    const cyclesMatch = comment.match(/^@cycles:\s*(\d+)$/);
    if (cyclesMatch) {
      directives.cycles = parseInt(cyclesMatch[1], 10);
      hasDirective = true;
      continue;
    }
  }

  return hasDirective ? directives : null;
}

// === Test execution ===

function compileAndRun(
  source: string,
  filename: string,
  directives: TestDirectives,
): Promise<number | string> {
  try {
    const libs: LowLevelProgram[] = [];
    if (directives.libs.has('std')) {
      libs.push(getStdLib());
    } else if (directives.libs.has('alloc')) {
      libs.push(getAllocator());
    }

    const userProgram = LowLevelProgram.parse(source, filename);
    const program = LowLevelProgram.concat([...libs, userProgram]);
    const typeErrors = program.typecheck().errors;

    if (typeErrors.length) {
      return Promise.resolve(typeErrors.map(e => e.text).join('\n'));
    }

    const entrypoint = getBareEntrypoint();
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binary] = combined.assemble();

    if (!binary) {
      return Promise.resolve(messages.errors.map(e => e.text).join('\n'));
    }

    const vm = new VM({ cycles: directives.cycles });
    return vm.run(binary.encode());
  } catch (e: any) {
    const msg = e.location
      ? `${e.location.filename}(${e.location.start.line}): ${e.message}`
      : e.message;
    return Promise.resolve(msg);
  }
}

// === Test discovery ===

function discoverTests(dir: string): Array<{ file: string; source: string; directives: TestDirectives }> {
  const tests: Array<{ file: string; source: string; directives: TestDirectives }> = [];

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.qll')) {
      continue;
    }

    const source = fs.readFileSync(path.join(dir, file), 'utf-8');
    const directives = parseDirectives(source);
    if (directives) {
      tests.push({ file, source, directives });
    }
  }

  return tests;
}

// === Run tests ===

const TEST_DIRS = [
  { dir: path.join(ROOT_DIR, 'tests', 'qll'), label: 'tests/qll' },
];

for (const { dir, label } of TEST_DIRS) {
  if (!fs.existsSync(dir)) {
    continue;
  }

  const tests = discoverTests(dir);
  if (tests.length === 0) {
    continue;
  }

  describe(label, () => {
    for (const { file, source, directives } of tests) {
      if (directives.skip) {
        test.skip(`${file}${directives.skipReason ? ` (${directives.skipReason})` : ''}`, () => {});
        continue;
      }

      if (directives.expectError !== undefined) {
        test(file, async () => {
          const result = await compileAndRun(source, file, directives);
          expect(typeof result).toBe('string');
          expect(result as string).toContain(directives.expectError);
        });
      } else if (directives.expect !== undefined) {
        test(file, async () => {
          const result = await compileAndRun(source, file, directives);
          if (typeof result === 'string') {
            throw new Error(`Expected ${directives.expect}, got error: ${result}`);
          }
          expect(result).toBe(directives.expect);
        });
      }
    }
  });
}
