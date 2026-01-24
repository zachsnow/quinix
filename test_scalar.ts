import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { VM } from '@/vm/vm';
import fs from 'fs';
import path from 'path';

const systemFilename = path.resolve('./lib/bin/system.qasm');
const systemText = fs.readFileSync(systemFilename, 'utf-8');
const systemAssemblyProgram = AssemblyProgram.parse(systemText, systemFilename);

// Scalar allocation (no array loop)
const programText = `
function main(): byte {
  var p: * byte = new byte = 42;
  return *p;
}
`;

const program = LowLevelProgram.parse(programText);
program.typecheck();
let assemblyProgram = program.compile();
assemblyProgram = AssemblyProgram.concat([assemblyProgram, systemAssemblyProgram]);
const [messages, binaryProgram] = assemblyProgram.assemble();
if (!binaryProgram) {
  console.error('Assemble failed');
  process.exit(1);
}
const memory = binaryProgram.encode();
const vm = new VM({ cycles: 50000 });
try {
  const result = await vm.run(memory);
  console.log(`Scalar heap allocation: ${result}, cycles used: ${vm.stats.cycles}`);
} catch (e: any) {
  console.log(`Scalar heap allocation: ${e.message}`);
}
