import { Address } from '../lib/types';
import { Instruction, Operation, Program, Register } from "./instructions";
import { VM } from './vm';

describe('VM', () => {
  async function run(instructions: Instruction[]): Promise<number> {
    const program = new Program(instructions);

    const vm = new VM();
    return vm.run(program.encode());
  };

  async function dump(instructions: Instruction[], address: Address) {
    const program = new Program(instructions);

    const vm = new VM();
    await vm.run(program.encode());
    const view = vm.dump(address, 1);
    return view[0];
  }

  const binaryOp = (op: Operation, l: number, r: number) => {
    return [
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(l),
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(r),
      Instruction.createOperation(op, Register.R0, 1, 2),
      Instruction.createOperation(Operation.HALT),
    ];
  };

  const unaryOp = (op: Operation, n: number) => {
    return [
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(n),
      Instruction.createOperation(op, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ];
  };

  test('arithmetic: +', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.ADD, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.ADD, 0x0, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.ADD, 0xffffffff, 0x0))).resolves.toBe(0xffffffff),
      expect(run(binaryOp(Operation.ADD, 0xffffffff, 0x1))).resolves.toBe(0x0),
    ]);
  });

  test('arithmetic: -', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.SUB, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.SUB, 0x1, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.SUB, 0xffffffff, 0x1))).resolves.toBe(0xfffffffe),
      expect(run(binaryOp(Operation.SUB, 0x0, 0x1))).resolves.toBe(0xffffffff),
    ]);
  });

  test('arithmetic: *', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.MUL, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.MUL, 0x1, 0x2a))).resolves.toBe(42),
      expect(run(binaryOp(Operation.MUL, 0xffffffff, 0x2a))).resolves.toBe(-0x2a >>> 0),
      expect(run(binaryOp(Operation.MUL, 0xffffffff, 0x2a))).resolves.toBe(0xffffffd6),
    ]);
  });

  test('arithmetic: /', () => {
    return Promise.all([
      // expect(run(binaryOp(Operation.MUL, 0x0, 0x0))).resolves.toBe(0x0), // TODO: Trap!
      expect(run(binaryOp(Operation.DIV, 0x0, 0x1))).resolves.toBe(0),
      expect(run(binaryOp(Operation.DIV, 0x6, 0x2))).resolves.toBe(0x3),
      expect(run(binaryOp(Operation.DIV, 0x7, 0x2))).resolves.toBe(0x3),
    ]);
  });

  test('arithmetic: %', () => {
    return Promise.all([
      // expect(run(binaryOp(Operation.MUL, 0x0, 0x0))).resolves.toBe(0x0), // TODO: Trap!
      expect(run(binaryOp(Operation.MOD, 0x0, 0x1))).resolves.toBe(0),
      expect(run(binaryOp(Operation.MOD, 0x6, 0x2))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.MOD, 0x7, 0x2))).resolves.toBe(0x1),
    ]);
  });

  test('comparison: ==', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.EQ, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.EQ, 0x1, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.EQ, 0xffffffff, 0xffffffff))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.EQ, 0xffffffff, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.EQ, 0x1, 0xffffffff))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.EQ, 0xffffffff, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.EQ, 0x0, 0xffffffff))).resolves.toBe(0x1),
    ]);
  });

  test('comparison: !=', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.NEQ, 0x0, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.NEQ, 0x1, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.NEQ, 0xffffffff, 0xffffffff))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.NEQ, 0xffffffff, 0x1))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.NEQ, 0x1, 0xffffffff))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.NEQ, 0xffffffff, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.NEQ, 0x0, 0xffffffff))).resolves.toBe(0x0),
    ]);
  });

  test('comparison: <', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.LT, 0x0, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.LT, 0x0, 0x1))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.LT, 0xffffffff, 0xffffffff))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.LT, 0xffffffff, 0x1))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.LT, 0x1, 0xffffffff))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.LT, 0xffffffff, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.LT, 0x0, 0xffffffff))).resolves.toBe(0x1),
    ]);
  });

  test('comparison: >', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.GT, 0x0, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.GT, 0x1, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.GT, 0xffffffff, 0xffffffff))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.GT, 0x1, 0xffffffff))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.GT, 0xffffffff, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.GT, 0x0, 0xffffffff))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.GT, 0xffffffff, 0x0))).resolves.toBe(0x1),
    ]);
  });

  test('arithmetic: &', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.AND, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.AND, 0x0, 0x1))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.AND, 0x1, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.AND, 0xffffffff, 0xffffffff))).resolves.toBe(0xffffffff),
      expect(run(binaryOp(Operation.AND, 0xffffffff, 0x12345678))).resolves.toBe(0x12345678),
      expect(run(binaryOp(Operation.AND, 0xfffffff0, 0x12345678))).resolves.toBe(0x12345670),
      expect(run(binaryOp(Operation.AND, 0xffffff00, 0x12345678))).resolves.toBe(0x12345600),
      expect(run(binaryOp(Operation.AND, 0xfffff000, 0x12345678))).resolves.toBe(0x12345000),
      expect(run(binaryOp(Operation.AND, 0xffff0000, 0x12345678))).resolves.toBe(0x12340000),
      expect(run(binaryOp(Operation.AND, 0xfff00000, 0x12345678))).resolves.toBe(0x12300000),
      expect(run(binaryOp(Operation.AND, 0xff000000, 0x12345678))).resolves.toBe(0x12000000),
      expect(run(binaryOp(Operation.AND, 0xf0000000, 0x12345678))).resolves.toBe(0x10000000),
      expect(run(binaryOp(Operation.AND, 0xffffffff, 0xf2345678))).resolves.toBe(0xf2345678),
      expect(run(binaryOp(Operation.AND, 0xfffffff0, 0xf2345678))).resolves.toBe(0xf2345670),
      expect(run(binaryOp(Operation.AND, 0xffffff00, 0xf2345678))).resolves.toBe(0xf2345600),
      expect(run(binaryOp(Operation.AND, 0xfffff000, 0xf2345678))).resolves.toBe(0xf2345000),
      expect(run(binaryOp(Operation.AND, 0xffff0000, 0xf2345678))).resolves.toBe(0xf2340000),
      expect(run(binaryOp(Operation.AND, 0xfff00000, 0xf2345678))).resolves.toBe(0xf2300000),
      expect(run(binaryOp(Operation.AND, 0xff000000, 0xf2345678))).resolves.toBe(0xf2000000),
      expect(run(binaryOp(Operation.AND, 0xf0000000, 0xf2345678))).resolves.toBe(0xf0000000),
    ]);
  });

  test('arithmetic: |', () => {
    return Promise.all([
      expect(run(binaryOp(Operation.OR, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.OR, 0x0, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.OR, 0x1, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.OR, 0xffffffff, 0x00000000))).resolves.toBe(0xffffffff),
      expect(run(binaryOp(Operation.OR, 0xfffffff0, 0x00000000))).resolves.toBe(0xfffffff0),
      expect(run(binaryOp(Operation.OR, 0xffffff00, 0x00000000))).resolves.toBe(0xffffff00),
      expect(run(binaryOp(Operation.OR, 0xfffff000, 0x00000000))).resolves.toBe(0xfffff000),
      expect(run(binaryOp(Operation.OR, 0xffff0000, 0x00000000))).resolves.toBe(0xffff0000),
      expect(run(binaryOp(Operation.OR, 0xfff00000, 0x00000000))).resolves.toBe(0xfff00000),
      expect(run(binaryOp(Operation.OR, 0xff000000, 0x00000000))).resolves.toBe(0xff000000),
      expect(run(binaryOp(Operation.OR, 0xff000000, 0x00000000))).resolves.toBe(0xff000000),
      expect(run(binaryOp(Operation.OR, 0xf0000000, 0x00000000))).resolves.toBe(0xf0000000),
    ]);
  });

  test('arithmetic: ~', () => {
    expect.assertions(4);

    return Promise.all([
      expect(run(unaryOp(Operation.NOT, 0x0))).resolves.toBe(0xffffffff),
      expect(run(unaryOp(Operation.NOT, 0xffffffff))).resolves.toBe(0x0),
      expect(run(unaryOp(Operation.NOT, 0xffff0000))).resolves.toBe(0x0000ffff),
      expect(run(unaryOp(Operation.NOT, 0x0000ffff))).resolves.toBe(0xffff0000),
    ]);
  });

  test('mov', () => {
    return expect(run([
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x10),
      Instruction.createOperation(Operation.MOV, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ])).resolves.toBe(0x10);
  });

  test('mov', () => {
    return expect(run([
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x10),
      Instruction.createOperation(Operation.MOV, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ])).resolves.toBe(0x10);
  });

  test('store', () => {
    return expect(dump([
      Instruction.createOperation(Operation.CONSTANT, 0),
      Instruction.createImmediate(0x2000),
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x30),
      Instruction.createOperation(Operation.STORE, 0, 1),
    ], 0x2000)).resolves.toBe(0x30);
  });

  test('load', () => {
    return expect(run([
      Instruction.createOperation(Operation.CONSTANT, 0),
      Instruction.createImmediate(0x2000),
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x30),
      Instruction.createOperation(Operation.STORE, 0, 1),
      Instruction.createOperation(Operation.LOAD, 0, 0),
    ])).resolves.toBe(0x30);
  });
});
