import { Address } from "@/lib/types";
import { Instruction, Operation, Program, Register } from "./instructions";
import { DisplayPeripheral } from "./peripherals";
import { VM } from "./vm";

// Float conversion helpers for tests
const floatBuffer = new ArrayBuffer(4);
const floatIntView = new Uint32Array(floatBuffer);
const floatFloatView = new Float32Array(floatBuffer);

function floatToInt(f: number): number {
  floatFloatView[0] = f;
  return floatIntView[0];
}

function intToFloat(i: number): number {
  floatIntView[0] = i >>> 0;
  return floatFloatView[0];
}

describe("VM", () => {
  async function run(instructions: Instruction[]): Promise<number> {
    const program = new Program(instructions);

    const vm = new VM();
    return vm.run(program.encode());
  }

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

  test("arithmetic: +", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.ADD, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.ADD, 0x0, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.ADD, 0xffffffff, 0x0))).resolves.toBe(
        0xffffffff
      ),
      expect(run(binaryOp(Operation.ADD, 0xffffffff, 0x1))).resolves.toBe(0x0),
    ]);
  });

  test("arithmetic: -", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.SUB, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.SUB, 0x1, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.SUB, 0xffffffff, 0x1))).resolves.toBe(
        0xfffffffe
      ),
      expect(run(binaryOp(Operation.SUB, 0x0, 0x1))).resolves.toBe(0xffffffff),
    ]);
  });

  test("arithmetic: *", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.MUL, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.MUL, 0x1, 0x2a))).resolves.toBe(42),
      expect(run(binaryOp(Operation.MUL, 0xffffffff, 0x2a))).resolves.toBe(
        -0x2a >>> 0
      ),
      expect(run(binaryOp(Operation.MUL, 0xffffffff, 0x2a))).resolves.toBe(
        0xffffffd6
      ),
    ]);
  });

  test("arithmetic: /", () => {
    return Promise.all([
      // expect(run(binaryOp(Operation.MUL, 0x0, 0x0))).resolves.toBe(0x0), // TODO: Trap!
      expect(run(binaryOp(Operation.DIV, 0x0, 0x1))).resolves.toBe(0),
      expect(run(binaryOp(Operation.DIV, 0x6, 0x2))).resolves.toBe(0x3),
      expect(run(binaryOp(Operation.DIV, 0x7, 0x2))).resolves.toBe(0x3),
    ]);
  });

  test("arithmetic: %", () => {
    return Promise.all([
      // expect(run(binaryOp(Operation.MUL, 0x0, 0x0))).resolves.toBe(0x0), // TODO: Trap!
      expect(run(binaryOp(Operation.MOD, 0x0, 0x1))).resolves.toBe(0),
      expect(run(binaryOp(Operation.MOD, 0x6, 0x2))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.MOD, 0x7, 0x2))).resolves.toBe(0x1),
    ]);
  });

  test("comparison: ==", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.EQ, 0x0, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.EQ, 0x1, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.EQ, 0xffffffff, 0xffffffff))).resolves.toBe(
        0x1
      ),
      expect(run(binaryOp(Operation.EQ, 0xffffffff, 0x1))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.EQ, 0x1, 0xffffffff))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.EQ, 0xffffffff, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.EQ, 0x0, 0xffffffff))).resolves.toBe(0x0),
    ]);
  });

  test("comparison: !=", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.NEQ, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.NEQ, 0x1, 0x0))).resolves.toBe(0x1),
      expect(
        run(binaryOp(Operation.NEQ, 0xffffffff, 0xffffffff))
      ).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.NEQ, 0xffffffff, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.NEQ, 0x1, 0xffffffff))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.NEQ, 0xffffffff, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.NEQ, 0x0, 0xffffffff))).resolves.toBe(0x1),
    ]);
  });

  test("comparison: <", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.LT, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.LT, 0x0, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.LT, 0xffffffff, 0xffffffff))).resolves.toBe(
        0x0
      ),
      expect(run(binaryOp(Operation.LT, 0xffffffff, 0x1))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.LT, 0x1, 0xffffffff))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.LT, 0xffffffff, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.LT, 0x0, 0xffffffff))).resolves.toBe(0x1),
    ]);
  });

  test("comparison: >", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.GT, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.GT, 0x1, 0x0))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.GT, 0xffffffff, 0xffffffff))).resolves.toBe(
        0x0
      ),
      expect(run(binaryOp(Operation.GT, 0x1, 0xffffffff))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.GT, 0xffffffff, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.GT, 0x0, 0xffffffff))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.GT, 0xffffffff, 0x0))).resolves.toBe(0x1),
    ]);
  });

  test("arithmetic: &", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.AND, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.AND, 0x0, 0x1))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.AND, 0x1, 0x1))).resolves.toBe(0x1),
      expect(
        run(binaryOp(Operation.AND, 0xffffffff, 0xffffffff))
      ).resolves.toBe(0xffffffff),
      expect(
        run(binaryOp(Operation.AND, 0xffffffff, 0x12345678))
      ).resolves.toBe(0x12345678),
      expect(
        run(binaryOp(Operation.AND, 0xfffffff0, 0x12345678))
      ).resolves.toBe(0x12345670),
      expect(
        run(binaryOp(Operation.AND, 0xffffff00, 0x12345678))
      ).resolves.toBe(0x12345600),
      expect(
        run(binaryOp(Operation.AND, 0xfffff000, 0x12345678))
      ).resolves.toBe(0x12345000),
      expect(
        run(binaryOp(Operation.AND, 0xffff0000, 0x12345678))
      ).resolves.toBe(0x12340000),
      expect(
        run(binaryOp(Operation.AND, 0xfff00000, 0x12345678))
      ).resolves.toBe(0x12300000),
      expect(
        run(binaryOp(Operation.AND, 0xff000000, 0x12345678))
      ).resolves.toBe(0x12000000),
      expect(
        run(binaryOp(Operation.AND, 0xf0000000, 0x12345678))
      ).resolves.toBe(0x10000000),
      expect(
        run(binaryOp(Operation.AND, 0xffffffff, 0xf2345678))
      ).resolves.toBe(0xf2345678),
      expect(
        run(binaryOp(Operation.AND, 0xfffffff0, 0xf2345678))
      ).resolves.toBe(0xf2345670),
      expect(
        run(binaryOp(Operation.AND, 0xffffff00, 0xf2345678))
      ).resolves.toBe(0xf2345600),
      expect(
        run(binaryOp(Operation.AND, 0xfffff000, 0xf2345678))
      ).resolves.toBe(0xf2345000),
      expect(
        run(binaryOp(Operation.AND, 0xffff0000, 0xf2345678))
      ).resolves.toBe(0xf2340000),
      expect(
        run(binaryOp(Operation.AND, 0xfff00000, 0xf2345678))
      ).resolves.toBe(0xf2300000),
      expect(
        run(binaryOp(Operation.AND, 0xff000000, 0xf2345678))
      ).resolves.toBe(0xf2000000),
      expect(
        run(binaryOp(Operation.AND, 0xf0000000, 0xf2345678))
      ).resolves.toBe(0xf0000000),
    ]);
  });

  test("arithmetic: |", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.OR, 0x0, 0x0))).resolves.toBe(0x0),
      expect(run(binaryOp(Operation.OR, 0x0, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.OR, 0x1, 0x1))).resolves.toBe(0x1),
      expect(run(binaryOp(Operation.OR, 0xffffffff, 0x00000000))).resolves.toBe(
        0xffffffff
      ),
      expect(run(binaryOp(Operation.OR, 0xfffffff0, 0x00000000))).resolves.toBe(
        0xfffffff0
      ),
      expect(run(binaryOp(Operation.OR, 0xffffff00, 0x00000000))).resolves.toBe(
        0xffffff00
      ),
      expect(run(binaryOp(Operation.OR, 0xfffff000, 0x00000000))).resolves.toBe(
        0xfffff000
      ),
      expect(run(binaryOp(Operation.OR, 0xffff0000, 0x00000000))).resolves.toBe(
        0xffff0000
      ),
      expect(run(binaryOp(Operation.OR, 0xfff00000, 0x00000000))).resolves.toBe(
        0xfff00000
      ),
      expect(run(binaryOp(Operation.OR, 0xff000000, 0x00000000))).resolves.toBe(
        0xff000000
      ),
      expect(run(binaryOp(Operation.OR, 0xff000000, 0x00000000))).resolves.toBe(
        0xff000000
      ),
      expect(run(binaryOp(Operation.OR, 0xf0000000, 0x00000000))).resolves.toBe(
        0xf0000000
      ),
    ]);
  });

  test("arithmetic: ~", () => {
    expect.assertions(4);

    return Promise.all([
      expect(run(unaryOp(Operation.NOT, 0x0))).resolves.toBe(0xffffffff),
      expect(run(unaryOp(Operation.NOT, 0xffffffff))).resolves.toBe(0x0),
      expect(run(unaryOp(Operation.NOT, 0xffff0000))).resolves.toBe(0x0000ffff),
      expect(run(unaryOp(Operation.NOT, 0x0000ffff))).resolves.toBe(0xffff0000),
    ]);
  });

  test("mov", () => {
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(0x10),
        Instruction.createOperation(Operation.MOV, Register.R0, 1),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(0x10);
  });

  test("mov", () => {
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(0x10),
        Instruction.createOperation(Operation.MOV, Register.R0, 1),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(0x10);
  });

  test("store", () => {
    return expect(
      dump(
        [
          Instruction.createOperation(Operation.CONSTANT, 0),
          Instruction.createImmediate(0x2000),
          Instruction.createOperation(Operation.CONSTANT, 1),
          Instruction.createImmediate(0x30),
          Instruction.createOperation(Operation.STORE, 0, 1),
        ],
        0x2000
      )
    ).resolves.toBe(0x30);
  });

  test("load", () => {
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(0x2000),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(0x30),
        Instruction.createOperation(Operation.STORE, 0, 1),
        Instruction.createOperation(Operation.LOAD, 0, 0),
      ])
    ).resolves.toBe(0x30);
  });

  // Float arithmetic tests
  test("float: fadd", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.FADD, floatToInt(1.5), floatToInt(2.5)))).resolves.toBe(floatToInt(4.0)),
      expect(run(binaryOp(Operation.FADD, floatToInt(0.0), floatToInt(0.0)))).resolves.toBe(floatToInt(0.0)),
      expect(run(binaryOp(Operation.FADD, floatToInt(-1.0), floatToInt(1.0)))).resolves.toBe(floatToInt(0.0)),
      expect(run(binaryOp(Operation.FADD, floatToInt(0.1), floatToInt(0.2)))).resolves.toBe(floatToInt(0.1 + 0.2)),
    ]);
  });

  test("float: fsub", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.FSUB, floatToInt(4.0), floatToInt(1.5)))).resolves.toBe(floatToInt(2.5)),
      expect(run(binaryOp(Operation.FSUB, floatToInt(0.0), floatToInt(1.0)))).resolves.toBe(floatToInt(-1.0)),
      expect(run(binaryOp(Operation.FSUB, floatToInt(1.0), floatToInt(1.0)))).resolves.toBe(floatToInt(0.0)),
    ]);
  });

  test("float: fmul", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.FMUL, floatToInt(2.0), floatToInt(3.0)))).resolves.toBe(floatToInt(6.0)),
      expect(run(binaryOp(Operation.FMUL, floatToInt(1.5), floatToInt(2.0)))).resolves.toBe(floatToInt(3.0)),
      expect(run(binaryOp(Operation.FMUL, floatToInt(0.0), floatToInt(100.0)))).resolves.toBe(floatToInt(0.0)),
      expect(run(binaryOp(Operation.FMUL, floatToInt(-2.0), floatToInt(3.0)))).resolves.toBe(floatToInt(-6.0)),
    ]);
  });

  test("float: fdiv", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.FDIV, floatToInt(6.0), floatToInt(2.0)))).resolves.toBe(floatToInt(3.0)),
      expect(run(binaryOp(Operation.FDIV, floatToInt(7.0), floatToInt(2.0)))).resolves.toBe(floatToInt(3.5)),
      expect(run(binaryOp(Operation.FDIV, floatToInt(-6.0), floatToInt(2.0)))).resolves.toBe(floatToInt(-3.0)),
    ]);
  });

  // Float comparison tests
  test("float: feq", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.FEQ, floatToInt(1.0), floatToInt(1.0)))).resolves.toBe(1),
      expect(run(binaryOp(Operation.FEQ, floatToInt(1.0), floatToInt(2.0)))).resolves.toBe(0),
      expect(run(binaryOp(Operation.FEQ, floatToInt(-1.0), floatToInt(-1.0)))).resolves.toBe(1),
      expect(run(binaryOp(Operation.FEQ, floatToInt(0.0), floatToInt(0.0)))).resolves.toBe(1),
    ]);
  });

  test("float: flt", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.FLT, floatToInt(1.0), floatToInt(2.0)))).resolves.toBe(1),
      expect(run(binaryOp(Operation.FLT, floatToInt(2.0), floatToInt(1.0)))).resolves.toBe(0),
      expect(run(binaryOp(Operation.FLT, floatToInt(1.0), floatToInt(1.0)))).resolves.toBe(0),
      expect(run(binaryOp(Operation.FLT, floatToInt(-1.0), floatToInt(0.0)))).resolves.toBe(1),
    ]);
  });

  test("float: fgt", () => {
    return Promise.all([
      expect(run(binaryOp(Operation.FGT, floatToInt(2.0), floatToInt(1.0)))).resolves.toBe(1),
      expect(run(binaryOp(Operation.FGT, floatToInt(1.0), floatToInt(2.0)))).resolves.toBe(0),
      expect(run(binaryOp(Operation.FGT, floatToInt(1.0), floatToInt(1.0)))).resolves.toBe(0),
      expect(run(binaryOp(Operation.FGT, floatToInt(0.0), floatToInt(-1.0)))).resolves.toBe(1),
    ]);
  });

  // Float conversion tests
  test("float: itof", () => {
    return Promise.all([
      expect(run(unaryOp(Operation.ITOF, 42))).resolves.toBe(floatToInt(42.0)),
      expect(run(unaryOp(Operation.ITOF, 0))).resolves.toBe(floatToInt(0.0)),
      expect(run(unaryOp(Operation.ITOF, -1 >>> 0))).resolves.toBe(floatToInt(-1.0)),
      expect(run(unaryOp(Operation.ITOF, -42 >>> 0))).resolves.toBe(floatToInt(-42.0)),
    ]);
  });

  test("float: utof", () => {
    return Promise.all([
      expect(run(unaryOp(Operation.UTOF, 42))).resolves.toBe(floatToInt(42.0)),
      expect(run(unaryOp(Operation.UTOF, 0))).resolves.toBe(floatToInt(0.0)),
      expect(run(unaryOp(Operation.UTOF, 0xffffffff))).resolves.toBe(floatToInt(4294967295.0)),
    ]);
  });

  test("float: ftoi", () => {
    return Promise.all([
      expect(run(unaryOp(Operation.FTOI, floatToInt(42.0)))).resolves.toBe(42),
      expect(run(unaryOp(Operation.FTOI, floatToInt(3.7)))).resolves.toBe(3),
      expect(run(unaryOp(Operation.FTOI, floatToInt(3.2)))).resolves.toBe(3),
      expect(run(unaryOp(Operation.FTOI, floatToInt(-3.7)))).resolves.toBe((-3 >>> 0)),
      expect(run(unaryOp(Operation.FTOI, floatToInt(0.0)))).resolves.toBe(0),
    ]);
  });

  // Display peripheral tests
  describe("DisplayPeripheral", () => {
    // Helper: create a program that reads peripheral info and stores it, then halts
    function createDisplayTestProgram(
      displayBase: Address,
      fbAddress: Address,
      testPixels: number[]
    ): Instruction[] {
      const instructions: Instruction[] = [];

      // Write test pixels to framebuffer
      for (let i = 0; i < testPixels.length; i++) {
        instructions.push(
          Instruction.createOperation(Operation.CONSTANT, 0),
          Instruction.createImmediate(fbAddress + i),
          Instruction.createOperation(Operation.CONSTANT, 1),
          Instruction.createImmediate(testPixels[i]),
          Instruction.createOperation(Operation.STORE, 0, 1)
        );
      }

      // Set framebuffer pointer (at displayBase + 3)
      instructions.push(
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(displayBase + 3),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(fbAddress),
        Instruction.createOperation(Operation.STORE, 0, 1)
      );

      // Write FLIP command (0x01) to control register (at displayBase)
      instructions.push(
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(displayBase),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(0x01),
        Instruction.createOperation(Operation.STORE, 0, 1)
      );

      instructions.push(Instruction.createOperation(Operation.HALT));
      return instructions;
    }

    test("maps with correct dimensions", async () => {
      const display = new DisplayPeripheral(320, 200);
      const vm = new VM({ peripherals: [display] });

      // Run a minimal program just to init peripherals
      const program = new Program([Instruction.createOperation(Operation.HALT)]);
      await vm.run(program.encode());

      // Peripheral base is at 0x300 (PERIPHERAL_MEMORY_BASE_ADDR)
      const baseAddress = 0x300;

      // Check dimensions are set correctly
      const width = vm.dump(baseAddress + 1, 1)[0];
      const height = vm.dump(baseAddress + 2, 1)[0];
      const pointer = vm.dump(baseAddress + 3, 1)[0];

      expect(width).toBe(320);
      expect(height).toBe(200);
      expect(pointer).toBe(0);  // Initially null
    });

    test("FLIP calls renderer with framebuffer data", async () => {
      let capturedPixels: Uint32Array | null = null;
      let capturedWidth = 0;
      let capturedHeight = 0;

      const renderer = (pixels: Uint32Array, width: number, height: number) => {
        capturedPixels = pixels.slice();
        capturedWidth = width;
        capturedHeight = height;
      };

      const display = new DisplayPeripheral(4, 2, renderer);
      const vm = new VM({ peripherals: [display] });

      const displayBase = 0x300;
      const fbAddress = 0x3000;
      const testPixels = [
        0xFF0000FF,  // Red
        0xFF00FF00,  // Green
        0xFFFF0000,  // Blue
        0xFFFFFFFF,  // White
        0xFF000000,  // Black (opaque)
        0x80808080,  // Gray semi-transparent
        0x00000000,  // Transparent
        0xFFFF00FF,  // Magenta
      ];

      const program = new Program(createDisplayTestProgram(displayBase, fbAddress, testPixels));
      await vm.run(program.encode());

      expect(capturedPixels).not.toBeNull();
      expect(capturedWidth).toBe(4);
      expect(capturedHeight).toBe(2);
      expect(Array.from(capturedPixels!)).toEqual(testPixels);

      // Verify control is back to READY
      expect(vm.dump(displayBase, 1)[0]).toBe(0x00);
    });

    test("FLIP with null pointer does not call renderer", async () => {
      let rendererCalled = false;
      const renderer = () => { rendererCalled = true; };

      const display = new DisplayPeripheral(4, 4, renderer);
      const vm = new VM({ peripherals: [display] });

      const displayBase = 0x300;

      // Program that just writes FLIP without setting pointer
      const program = new Program([
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(displayBase),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(0x01),
        Instruction.createOperation(Operation.STORE, 0, 1),
        Instruction.createOperation(Operation.HALT),
      ]);
      await vm.run(program.encode());

      expect(rendererCalled).toBe(false);
      expect(vm.dump(displayBase, 1)[0]).toBe(0x00);
    });
  });
});
