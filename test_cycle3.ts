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

// Binary search for minimum cycles needed
let low = 1000, high = 100000;
while (low < high) {
  const mid = Math.floor((low + high) / 2);
  const vm = new VM({ cycles: mid });
  try {
    const result = await vm.run(memory);
    high = mid;
    console.log(`${mid} cycles: SUCCESS (result = ${result})`);
  } catch (e) {
    low = mid + 1;
    console.log(`${mid} cycles: TIMEOUT`);
  }
}
console.log(`Minimum cycles needed: ${low}`);
