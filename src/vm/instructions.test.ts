import { Instruction, Operation, Register } from './instructions';
​
describe('Instructions', () => {
  test('instructions encode correctly', () => {
    const r1 = 0x1;
    const r2 = 0x2;
    const r3 = 0x3;

    expect(Instruction.createOperation(Operation.HALT).encode()).toBe(0x0);
    expect(Instruction.createOperation(Operation.LOAD, Register.R0, r1).encode()).toBe(0x02000100);
    expect(Instruction.createOperation(Operation.STORE, r2, r3).encode()).toBe(0x03020300);
    expect(Instruction.createOperation(Operation.CONSTANT, r3).encode()).toBe(0x05030000);
    expect(Instruction.createOperation(Operation.JMP, undefined, r2).encode()).toBe(0x12000200);
  });

  test('immediates encode correctly', () => {
    expect(Instruction.createImmediate(0x0).encode()).toBe(0x0);
    expect(Instruction.createImmediate(-0x1).encode()).toBe(0xffffffff);
    expect(Instruction.createImmediate(0xdeadbeef).encode()).toBe(0xdeadbeef);
    expect(Instruction.createImmediate(0xffffffff).encode()).toBe(0xffffffff);
    expect(Instruction.createImmediate(-0x1).encode()).toBe(0xffffffff);
  });

  test('instructions decode correctly', () => {
    const r1 = 0x1;
    const r2 = 0x2;
    const r3 = 0x3;

    expect(Instruction.decode(0x0).operation).toBe(Operation.HALT);
    expect(Instruction.decode(0x02000100).operation).toBe(Operation.LOAD);
    expect(Instruction.decode(0x02000100).dr).toBe(Register.R0);
    expect(Instruction.decode(0x02000100).sr0).toBe(r1);
    expect(Instruction.decode(0x03020300).operation).toBe(Operation.STORE);
    expect(Instruction.decode(0x03020300).dr).toBe(r2);
    expect(Instruction.decode(0x03020300).sr0).toBe(r3);
    expect(Instruction.decode(0x05030000).operation).toBe(Operation.CONSTANT);
    expect(Instruction.decode(0x05030000).dr).toBe(r3);
    expect(Instruction.decode(0x12000200).operation).toBe(Operation.JMP);
    expect(Instruction.decode(0x12000200).sr0).toBe(r2);
  });

  test('instructions toString correct', () => {
    const r1 = 0x1;
    const r2 = 0x2;
    const r3 = 0x3;

    expect(Instruction.createOperation(Operation.HALT).toString()).toBe('halt');
    expect(Instruction.createOperation(Operation.LOAD, Register.R0, r1).toString()).toBe('load r0 r1');
    expect(Instruction.createOperation(Operation.STORE, r2, r3).toString()).toBe('store r2 r3');
    expect(Instruction.createOperation(Operation.CONSTANT, r3).toString()).toBe('constant r3');
    expect(Instruction.createOperation(Operation.JMP, undefined, r2).toString()).toBe('jmp r2');
    expect(Instruction.createOperation(Operation.WAIT).toString()).toBe('wait');
  });
});
