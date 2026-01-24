import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { VM } from '@/vm/vm';
import fs from 'fs';
import path from 'path';

const systemFilename = path.resolve('./lib/bin/system.qasm');
const systemText = fs.readFileSync(systemFilename, 'utf-8');
const systemAssemblyProgram = AssemblyProgram.parse(systemText, systemFilename);

const programText = `
type Point = struct { x: byte; y: byte; };
function main(): byte {
  var ps: Point[] = new Point[13];
  ps[3].x = 4;
  return len ps;
}
`;

const program = LowLevelProgram.parse(programText);
program.typecheck();
let assemblyProgram = program.compile();
assemblyProgram = AssemblyProgram.concat([assemblyProgram, systemAssemblyProgram]);
const [messages, binaryProgram] = assemblyProgram.assemble();
if (!binaryProgram) {
  console.error('Assemble failed:', messages?.toString());
  process.exit(1);
}
const memory = binaryProgram.encode();

// Try with different cycle limits
for (const cycles of [1000, 5000, 10000, 50000]) {
  const vm = new VM({ cycles });
  try {
    const result = await vm.run(memory);
    console.log(`Cycles ${cycles}: result = ${result}`);
    break;
  } catch (e: any) {
    console.log(`Cycles ${cycles}: ${e.message}`);
  }
}
