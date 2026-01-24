import { LowLevelProgram } from '@/lowlevel/lowlevel';

const programText = `
  function main(): byte {
    var ar: byte[10];
    len ar = 5;
    return len ar;
  }
`;

const program = LowLevelProgram.parse(programText);
const errors = program.typecheck().errors.map((e) => e.text);
console.log('Errors:', errors);
