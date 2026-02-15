/**
 * Unified file-based test runner for QLL and QASM programs.
 *
 * Discovers test files with directive comments and runs them.
 * Directives (in comments at the top of the file):
 *   @expect: <number>       - expected return value (decimal or hex)
 *   @expect-error: <string> - expected compilation/assembly error substring
 *   @libs: <names>          - comma-separated library names (per-language)
 *   @stdout: "string"        - expected stdout output (supports \n, \\, \")
 *   @cycles: <number>       - VM cycle budget
 *   @skip                   - skip this test
 *   @skip: <reason>         - skip with reason
 */

import fs from 'fs';
import path from 'path';

import { VM } from '@/vm/vm';
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { TimerPeripheral, ClockPeripheral } from '@/vm/peripherals';
import { DebugBreakPeripheral, DebugOutputPeripheral } from '@/platform/server/peripherals';
import { getStdLib, getBareEntrypoint, getAllocator } from '@test/helpers';

const ROOT_DIR = path.resolve(__dirname, '..', '..');

// === Directive parsing ===

interface TestDirectives {
  expect?: number;
  expectError?: string;
  stdout?: string;
  libs: Set<string>;
  cycles: number;
  skip: boolean;
  skipReason?: string;
}

function parseQuotedString(raw: string): string {
  if (!raw.startsWith('"') || !raw.endsWith('"')) {
    throw new Error(`@stdout value must be quoted: ${raw}`);
  }
  let result = '';
  for (let i = 1; i < raw.length - 1; i++) {
    if (raw[i] === '\\') {
      i++;
      switch (raw[i]) {
        case 'n': result += '\n'; break;
        case 't': result += '\t'; break;
        case '\\': result += '\\'; break;
        case '"': result += '"'; break;
        default: result += '\\' + raw[i]; break;
      }
    } else {
      result += raw[i];
    }
  }
  return result;
}

function parseDirectives(source: string, commentPrefix: string, defaultCycles: number): TestDirectives | null {
  const directives: TestDirectives = {
    libs: new Set(),
    cycles: defaultCycles,
    skip: false,
  };

  let hasDirective = false;

  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(commentPrefix)) {
      continue;
    }
    const comment = trimmed.slice(commentPrefix.length).trim();

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

    const stdoutMatch = comment.match(/^@stdout:\s*(".*")$/);
    if (stdoutMatch) {
      directives.stdout = parseQuotedString(stdoutMatch[1]);
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

// === Per-language run functions ===

interface RunResult {
  result: number | string;
  output: string;
}

function runQLL(
  source: string,
  filename: string,
  directives: TestDirectives,
): Promise<RunResult> {
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
      return Promise.resolve({ result: typeErrors.map(e => e.text).join('\n'), output: '' });
    }

    const entrypoint = getBareEntrypoint();
    const combined = AssemblyProgram.concat([entrypoint, program.compile()]);
    const [messages, binary] = combined.assemble();

    if (!binary) {
      return Promise.resolve({ result: messages.errors.map(e => e.text).join('\n'), output: '' });
    }

    const debugOutput = new DebugOutputPeripheral();
    const peripherals = [
      new TimerPeripheral(),
      new ClockPeripheral(),
      new DebugBreakPeripheral(),
      debugOutput,
    ];

    const vm = new VM({ cycles: directives.cycles, peripherals });
    return vm.run(binary.encode()).then(
      result => ({ result, output: debugOutput.output.replace(/\0+$/, '') }),
      (e: any) => ({ result: e.message ?? String(e), output: debugOutput.output.replace(/\0+$/, '') }),
    );
  } catch (e: any) {
    const msg = e.location
      ? `${e.location.filename}(${e.location.start.line}): ${e.message}`
      : e.message;
    return Promise.resolve({ result: msg, output: '' });
  }
}

// QASM library map — empty for now; add entries as needed.
const QASM_LIBS: Record<string, string> = {};

function runQASM(
  source: string,
  filename: string,
  directives: TestDirectives,
): Promise<RunResult> {
  try {
    const programs: AssemblyProgram[] = [];

    for (const lib of directives.libs) {
      const libPath = QASM_LIBS[lib];
      if (!libPath) {
        return Promise.resolve({ result: `Unknown QASM lib: ${lib}`, output: '' });
      }
      const libSource = fs.readFileSync(path.join(ROOT_DIR, libPath), 'utf-8');
      programs.push(AssemblyProgram.parse(libSource, libPath));
    }

    programs.push(AssemblyProgram.parse(source, filename));
    const combined = AssemblyProgram.concat(programs);
    const [messages, binary] = combined.assemble();

    if (!binary) {
      return Promise.resolve({ result: messages.errors.map(e => e.text).join('\n'), output: '' });
    }

    const vm = new VM({ cycles: directives.cycles });
    return vm.run(binary.encode()).then(
      result => ({ result, output: '' }),
      (e: any) => ({ result: e.message ?? String(e), output: '' }),
    );
  } catch (e: any) {
    const msg = e.location
      ? `${e.location.filename}(${e.location.start.line}): ${e.message}`
      : e.message;
    return Promise.resolve({ result: msg, output: '' });
  }
}

// === Test discovery ===

interface TestEntry {
  file: string;
  source: string;
  directives: TestDirectives;
}

function discoverTests(dir: string, ext: string, commentPrefix: string, defaultCycles: number): TestEntry[] {
  const tests: TestEntry[] = [];

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(ext)) {
      continue;
    }

    const source = fs.readFileSync(path.join(dir, file), 'utf-8');
    const directives = parseDirectives(source, commentPrefix, defaultCycles);
    if (directives) {
      tests.push({ file, source, directives });
    }
  }

  return tests;
}

// === Run tests ===

type RunFn = (source: string, filename: string, directives: TestDirectives) => Promise<RunResult>;

const TEST_SUITES: Array<{ dir: string; ext: string; commentPrefix: string; defaultCycles: number; run: RunFn }> = [
  { dir: path.join(ROOT_DIR, 'tests', 'qll'),  ext: '.qll',  commentPrefix: '//', defaultCycles: 5000, run: runQLL },
  { dir: path.join(ROOT_DIR, 'tests', 'qasm'), ext: '.qasm', commentPrefix: ';',  defaultCycles: 500,  run: runQASM },
];

for (const suite of TEST_SUITES) {
  if (!fs.existsSync(suite.dir)) {
    continue;
  }

  const tests = discoverTests(suite.dir, suite.ext, suite.commentPrefix, suite.defaultCycles);
  if (tests.length === 0) {
    continue;
  }

  const label = path.relative(ROOT_DIR, suite.dir);

  describe(label, () => {
    for (const { file, source, directives } of tests) {
      if (directives.skip) {
        test.skip(`${file}${directives.skipReason ? ` (${directives.skipReason})` : ''}`, () => {});
        continue;
      }

      if (directives.expectError !== undefined) {
        test(file, async () => {
          const { result } = await suite.run(source, file, directives);
          expect(typeof result).toBe('string');
          expect(result as string).toContain(directives.expectError);
        });
      } else if (directives.expect !== undefined || directives.stdout !== undefined) {
        test(file, async () => {
          const { result, output } = await suite.run(source, file, directives);
          if (typeof result === 'string') {
            throw new Error(`Expected success, got error: ${result}`);
          }
          if (directives.expect !== undefined) {
            expect(result).toBe(directives.expect);
          }
          if (directives.stdout !== undefined) {
            expect(output).toBe(directives.stdout);
          }
        });
      }
    }
  });
}
