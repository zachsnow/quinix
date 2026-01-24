import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';
import fs from 'fs';

const programText = `
function main(): byte {
  var arr: byte[] = new byte[5];
  return arr[0];
}
`;

const program = LowLevelProgram.parse(programText);
program.typecheck();
const assemblyProgram = program.compile();

// Print the assembly
console.log(assemblyProgram.toString().split('\n').slice(0, 200).join('\n'));
