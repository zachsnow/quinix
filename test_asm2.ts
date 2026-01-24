import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { AssemblyProgram } from '@/assembly/assembly';

const programText = `
function main(): byte {
  var b: byte[] = new byte[8];
  b[5] = 10;
  return b[5];
}
`;

const program = LowLevelProgram.parse(programText);
program.typecheck();
const assemblyProgram = program.compile();

console.log(assemblyProgram.toString());
