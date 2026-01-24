import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { VM } from '@/vm/vm';
import fs from 'fs';
import path from 'path';

const systemFilename = path.resolve('./lib/bin/system.qasm');
const systemText = fs.readFileSync(systemFilename, 'utf-8');
const systemAssemblyProgram = AssemblyProgram.parse(systemText, systemFilename);

const programText = `
function main(): byte {
  var b: byte[] = new byte[8];
  b[5] = 10;
  return b[5];
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

for (const cycles of [500, 2000, 10000, 50000]) {
  const vm = new VM({ cycles });
  try {
    const result = await vm.run(memory);
    console.log(cycles + ' cycles: result = ' + result);
    break;
  } catch (e: any) {
    console.log(cycles + ' cycles: ' + e.message);
  }
}
