import fs from 'fs';
import path from 'path';
import { AssemblyProgram } from '@/assembly/assembly';
import { LowLevelProgram } from '@/lowlevel/lowlevel';

const programText = `
  function main(): byte {
    var b: byte[] = new byte[8];
    b[5] = 10;
    return b[5];
  }
`;

// Method 1: How qasm does it (parse system.qasm fresh)
const systemFilename = path.resolve('./lib/bin/system.qasm');
const systemText = fs.readFileSync(systemFilename, 'utf-8');

// Method 2: How test does it (pre-parse and reuse)
const systemAssemblyProgram = AssemblyProgram.parse(systemText, systemFilename);

// Compile test program
const program = LowLevelProgram.parse(programText);
program.typecheck();
const testAssemblyProgram = program.compile();

console.log('Test program directives:', testAssemblyProgram.directives.length);
console.log('System program directives:', systemAssemblyProgram.directives.length);

// Method 1: Fresh parse (like qasm)
const freshSystemProgram = AssemblyProgram.parse(systemText, systemFilename);
const method1 = AssemblyProgram.concat([testAssemblyProgram, freshSystemProgram]);
console.log('Method 1 (fresh parse) total directives:', method1.directives.length);

// Method 2: Reuse (like test)
const method2 = AssemblyProgram.concat([testAssemblyProgram, systemAssemblyProgram]);
console.log('Method 2 (reuse) total directives:', method2.directives.length);

// Compare first 20 directives
console.log('\nFirst 10 method1 directives:');
for (let i = 0; i < 10; i++) {
  const d = method1.directives[i];
  if (d) console.log('  ' + i + ': ' + d.toString().slice(0, 60));
}

console.log('\nFirst 10 method2 directives:');
for (let i = 0; i < 10; i++) {
  const d = method2.directives[i];
  if (d) console.log('  ' + i + ': ' + d.toString().slice(0, 60));
}

// Try assembling both
const [msg1, bin1] = method1.assemble();
const [msg2, bin2] = method2.assemble();

console.log('\nMethod 1 assemble:', bin1 ? 'success' : 'failed');
console.log('Method 2 assemble:', bin2 ? 'success' : 'failed');

// Write out the binary so we can compare with qasm output
import { VM } from '@/vm/vm';

if (bin2) {
  const memory = bin2.encode();
  fs.writeFileSync('test_out.qbin', memory.toBytes());
  console.log('\nWrote test_out.qbin');
  console.log('Binary size:', memory.length, 'words');

  // Print first 20 words
  console.log('First 20 words:');
  for (let i = 0; i < 20; i++) {
    console.log('  ' + i.toString(16).padStart(4, '0') + ': ' + memory.get(i).toString(16).padStart(8, '0'));
  }
}
