import fs from 'fs';
import { AssemblyProgram } from '@/assembly/assembly';
import { LowLevelProgram } from '@/lowlevel/lowlevel';
import { VM } from '@/vm/vm';
import { Immediate } from '@/lib/types';

const programText = `
  function main(): byte {
    var b: byte[] = new byte [8];
    b[5] = 10;
    return b[5];
  }
`;

const systemFilename = './lib/bin/system.qasm';
const systemText = fs.readFileSync(systemFilename, 'utf-8');
const systemAssemblyProgram = AssemblyProgram.parse(systemText, systemFilename);

const program = LowLevelProgram.parse(programText);
program.typecheck();
let assemblyProgram = program.compile();
assemblyProgram = AssemblyProgram.concat([assemblyProgram, systemAssemblyProgram]);

const [messages, binaryProgram] = assemblyProgram.assemble();
if (!binaryProgram) {
  console.log('Assembly failed!');
  process.exit(1);
}

const memory = binaryProgram.encode();
const vm = new VM({
  debug: true,
  cycles: 100,
});

// Hook into the VM's step function to trace execution
let stepCount = 0;
const originalStep = vm.step.bind(vm);
vm.step = function() {
  if (stepCount < 50) {
    console.log(`Step ${stepCount}: IP=${Immediate.toString(this.ip)} R0=${Immediate.toString(this.r0)}`);
    stepCount++;
  }
  return originalStep();
};

try {
  vm.run(memory);
} catch (e: any) {
  console.log('Error:', e.message);
}
