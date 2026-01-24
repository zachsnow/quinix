import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import { VM } from '@/vm/vm';
import fs from 'fs';
import path from 'path';

// Test WITHOUT system library first
const programText1 = `
function main(): byte {
  var arr: byte[5];
  arr[3] = 10;
  return arr[3];
}
`;

const program1 = LowLevelProgram.parse(programText1);
program1.typecheck();
const assemblyProgram1 = program1.compile();
const [messages1, binaryProgram1] = assemblyProgram1.assemble();
if (!binaryProgram1) {
  console.error('Assemble1 failed');
  process.exit(1);
}
const memory1 = binaryProgram1.encode();
const vm1 = new VM({ cycles: 500 });
try {
  const result1 = await vm1.run(memory1);
  console.log(`Without system (stack array): ${result1}, cycles used: ${vm1.stats.cycles}`);
} catch (e: any) {
  console.log(`Without system (stack array): ${e.message}`);
}

// Now test WITH system library
const systemFilename = path.resolve('./lib/bin/system.qasm');
const systemText = fs.readFileSync(systemFilename, 'utf-8');
const systemAssemblyProgram = AssemblyProgram.parse(systemText, systemFilename);

const programText2 = `
function main(): byte {
  var arr: byte[] = new byte[5];
  arr[3] = 10;
  return arr[3];
}
`;

const program2 = LowLevelProgram.parse(programText2);
program2.typecheck();
let assemblyProgram2 = program2.compile();
assemblyProgram2 = AssemblyProgram.concat([assemblyProgram2, systemAssemblyProgram]);
const [messages2, binaryProgram2] = assemblyProgram2.assemble();
if (!binaryProgram2) {
  console.error('Assemble2 failed');
  process.exit(1);
}
const memory2 = binaryProgram2.encode();
const vm2 = new VM({ cycles: 50000 });
try {
  const result2 = await vm2.run(memory2);
  console.log(`With system (heap array): ${result2}, cycles used: ${vm2.stats.cycles}`);
} catch (e: any) {
  console.log(`With system (heap array): ${e.message}`);
}
