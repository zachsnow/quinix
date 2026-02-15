import { Address } from "@/lib/types";
import { Instruction, Operation, Program, Register } from "./instructions";
import { BufferedPeripheral, DisplayPeripheral, TimerPeripheral, ClockPeripheral } from "./peripherals";
import { VM } from "./vm";
import { floatToInt, intToFloat, runInstructions, runAndDump, binaryOp, unaryOp } from "@test/helpers";

describe("VM", () => {
  const run = runInstructions;

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
      runAndDump(
        [
          Instruction.createOperation(Operation.CONSTANT, 0),
          Instruction.createImmediate(0x2000),
          Instruction.createOperation(Operation.CONSTANT, 1),
          Instruction.createImmediate(0x30),
          Instruction.createOperation(Operation.STORE, 0, 1),
        ],
        0x2000
      ).then(v => v[0])
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

  // Test output peripheral that captures data instead of writing to stdout
  class TestOutputPeripheral extends BufferedPeripheral {
    public readonly name = "test-output";
    public readonly identifier = 0x10000001;
    public captured: number[] = [];

    protected async onWrite(data: number[]): Promise<void> {
      this.captured.push(...data);
    }
  }

  // Test input peripheral that provides canned data instead of reading from stdin
  class TestInputPeripheral extends BufferedPeripheral {
    public readonly name = "test-input";
    public readonly identifier = 0x10000002;
    private data: number[];

    constructor(data: number[]) {
      super();
      this.data = data;
    }

    protected async onRead(): Promise<number[]> {
      return this.data;
    }
  }

  describe("BufferedPeripheral output", () => {
    test("captures written data via VM execution", async () => {
      const output = new TestOutputPeripheral();
      const vm = new VM({ peripherals: [output] });

      const peripheralBase = 0x300;
      const CONTROL = peripheralBase + 0;
      const SIZE = peripheralBase + 2;
      const BUFFER = peripheralBase + 3;

      // Program that writes "Hi" (0x48, 0x69) to the output peripheral
      const program = new Program([
        // Write 'H' to buffer[0]
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(BUFFER),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(0x48), // 'H'
        Instruction.createOperation(Operation.STORE, 0, 1),

        // Write 'i' to buffer[1]
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(BUFFER + 1),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(0x69), // 'i'
        Instruction.createOperation(Operation.STORE, 0, 1),

        // Write size = 2
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(SIZE),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(2),
        Instruction.createOperation(Operation.STORE, 0, 1),

        // Write CONTROL = 1 (WRITE command)
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(CONTROL),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(1),
        Instruction.createOperation(Operation.STORE, 0, 1),

        // Wait for completion (poll CONTROL until 0)
        // @poll: (word 20)
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(CONTROL),
        Instruction.createOperation(Operation.LOAD, 1, 0),
        Instruction.createOperation(Operation.CONSTANT, 2),
        Instruction.createImmediate(20), // address of @poll (word 20)
        Instruction.createOperation(Operation.JNZ, undefined, 1, 2),

        Instruction.createOperation(Operation.HALT),
      ]);

      await vm.run(program.encode());

      expect(output.captured).toEqual([0x48, 0x69]);
    });
  });

  describe("BufferedPeripheral input", () => {
    test("triggers read and receives data", async () => {
      let readCalled = false;

      // Custom input peripheral that tracks when onRead is called
      class TrackingInputPeripheral extends BufferedPeripheral {
        public readonly name = "tracking-input";
        public readonly identifier = 0x10000003;

        protected async onRead(): Promise<number[]> {
          readCalled = true;
          return [0x41, 0x42, 0x43]; // "ABC"
        }
      }

      const input = new TrackingInputPeripheral();
      const vm = new VM({ peripherals: [input] });

      const peripheralBase = 0x300;
      const CONTROL = peripheralBase + 0;

      // Program that triggers a read command
      const program = new Program([
        // Write CONTROL = 2 (READ command)
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(CONTROL),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(2),
        Instruction.createOperation(Operation.STORE, 0, 1),

        // Small delay to let async complete
        Instruction.createOperation(Operation.CONSTANT, 2),
        Instruction.createImmediate(1000),
        // @loop: (word 7)
        Instruction.createOperation(Operation.CONSTANT, 3),
        Instruction.createImmediate(1),
        Instruction.createOperation(Operation.SUB, 2, 2, 3),
        Instruction.createOperation(Operation.CONSTANT, 4),
        Instruction.createImmediate(7),
        Instruction.createOperation(Operation.JNZ, undefined, 2, 4),

        Instruction.createOperation(Operation.HALT),
      ]);

      await vm.run(program.encode());

      // Verify that the read was triggered
      expect(readCalled).toBe(true);
    });
  });

  describe("TimerPeripheral", () => {
    test("can be configured via memory write", async () => {
      const timer = new TimerPeripheral();
      const vm = new VM({ peripherals: [timer] });

      const timerBase = 0x300;

      // Program that configures timer and then disables it
      const program = new Program([
        // Configure timer for 100ms interval
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(timerBase),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(100),
        Instruction.createOperation(Operation.STORE, 0, 1),

        // Disable timer
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(timerBase),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(0),
        Instruction.createOperation(Operation.STORE, 0, 1),

        Instruction.createOperation(Operation.HALT),
      ]);

      // Should complete without hanging or errors
      await vm.run(program.encode());

      // Timer memory should show 0 (disabled)
      const timerValue = vm.dump(timerBase, 1)[0];
      expect(timerValue).toBe(0);
    });

    // Note: Timer interrupt testing requires setTimeout callbacks to fire,
    // which won't happen during tight CPU loops using queueMicrotask yields.
    // Full timer interrupt testing requires either:
    // - Using setTimeout for yields (slower but allows timer callbacks)
    // - External test harness that waits for real time to pass
  });

  test("arithmetic: <<", () => {
    return Promise.all([
      // Zero shift
      expect(run(binaryOp(Operation.SHL, 0x1, 0x0))).resolves.toBe(0x1),
      // Single bit
      expect(run(binaryOp(Operation.SHL, 0x1, 0x1))).resolves.toBe(0x2),
      // Multi-bit
      expect(run(binaryOp(Operation.SHL, 0x1, 0x4))).resolves.toBe(0x10),
      // Shift by 31
      expect(run(binaryOp(Operation.SHL, 0x1, 31))).resolves.toBe(0x80000000),
      // Shift by 32 wraps to 0 via mask
      expect(run(binaryOp(Operation.SHL, 0x1, 32))).resolves.toBe(0x1),
    ]);
  });

  test("arithmetic: >>", () => {
    return Promise.all([
      // Single bit
      expect(run(binaryOp(Operation.SHR, 0x2, 0x1))).resolves.toBe(0x1),
      // High bit
      expect(run(binaryOp(Operation.SHR, 0x80000000, 0x1))).resolves.toBe(0x40000000),
      // Multi-bit
      expect(run(binaryOp(Operation.SHR, 0x100, 0x4))).resolves.toBe(0x10),
      // Zero shift
      expect(run(binaryOp(Operation.SHR, 0xdeadbeef, 0x0))).resolves.toBe(0xdeadbeef),
      // Shift by 31
      expect(run(binaryOp(Operation.SHR, 0x80000000, 31))).resolves.toBe(0x1),
    ]);
  });

  test("constant", () => {
    return Promise.all([
      expect(run(unaryOp(Operation.MOV, 0))).resolves.toBe(0),
      expect(
        run([
          Instruction.createOperation(Operation.CONSTANT, Register.R0),
          Instruction.createImmediate(42),
          Instruction.createOperation(Operation.HALT),
        ])
      ).resolves.toBe(42),
      expect(
        run([
          Instruction.createOperation(Operation.CONSTANT, Register.R0),
          Instruction.createImmediate(0xffffffff),
          Instruction.createOperation(Operation.HALT),
        ])
      ).resolves.toBe(0xffffffff),
    ]);
  });

  test("jmp", () => {
    // Jump over an instruction that would set r0=0xFF
    // Layout: [0]const r0 [1]42 [2]const r1 [3]addr [4]jmp [5]const r0 [6]0xff [7]halt
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(42),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(VM.PROGRAM_ADDR + 7),
        Instruction.createOperation(Operation.JMP, undefined, 1),
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(0xff),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(42);
  });

  test("jz: taken when r0=0", () => {
    // Layout: [0]const r1 [1]addr [2]jz [3]const r0 [4]0xff [5]halt
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(VM.PROGRAM_ADDR + 5),
        Instruction.createOperation(Operation.JZ, undefined, Register.R0, 1),
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(0xff),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(0);
  });

  test("jz: not taken when r0!=0", () => {
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(1),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(VM.PROGRAM_ADDR + 100),
        Instruction.createOperation(Operation.JZ, undefined, Register.R0, 1),
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(42),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(42);
  });

  test("jnz: taken when r0!=0", () => {
    // Layout: [0]const r0 [1]1 [2]const r1 [3]addr [4]jnz [5]const r0 [6]0xff [7]halt
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(1),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(VM.PROGRAM_ADDR + 7),
        Instruction.createOperation(Operation.JNZ, undefined, Register.R0, 1),
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(0xff),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(1);
  });

  test("jnz: not taken when r0=0", () => {
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(VM.PROGRAM_ADDR + 100),
        Instruction.createOperation(Operation.JNZ, undefined, Register.R0, 1),
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(42),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(42);
  });

  test("rjmp: forward skip", () => {
    // Layout: [0]const r0 [1]99 [2]const r1 [3]3 [4]rjmp [5]const r0 [6]0xff [7]halt
    // rjmp at 4, offset 3 → IP = 4+3 = 7 = halt
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(99),
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(3),
        Instruction.createOperation(Operation.RJMP, undefined, 1),
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(0xff),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(99);
  });

  test("rjz: taken and not-taken", () => {
    return Promise.all([
      // Taken: r0=0, jump forward
      // Layout: [0]const r1 [1]3 [2]rjz [3]const r0 [4]0xff [5]halt
      // rjz at 2, offset 3 → IP = 2+3 = 5 = halt
      expect(
        run([
          Instruction.createOperation(Operation.CONSTANT, 1),
          Instruction.createImmediate(3),
          Instruction.createOperation(Operation.RJZ, undefined, Register.R0, 1),
          Instruction.createOperation(Operation.CONSTANT, Register.R0),
          Instruction.createImmediate(0xff),
          Instruction.createOperation(Operation.HALT),
        ])
      ).resolves.toBe(0),
      // Not taken: r0=1
      expect(
        run([
          Instruction.createOperation(Operation.CONSTANT, Register.R0),
          Instruction.createImmediate(1),
          Instruction.createOperation(Operation.CONSTANT, 1),
          Instruction.createImmediate(100),
          Instruction.createOperation(Operation.RJZ, undefined, Register.R0, 1),
          Instruction.createOperation(Operation.CONSTANT, Register.R0),
          Instruction.createImmediate(42),
          Instruction.createOperation(Operation.HALT),
        ])
      ).resolves.toBe(42),
    ]);
  });

  test("rjnz: backward loop counts to N", () => {
    // Count from 0 to 5 using rjnz to loop backward
    // Layout: [0]const r1 [1]5 [2]const r2 [3]1 [4]const r4 [5]-2
    //         [6]add [7]neq [8]rjnz [9]halt
    // rjnz at 8, offset -2 → IP = 8+(-2) = 6 = add (loop body)
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(5),
        Instruction.createOperation(Operation.CONSTANT, 2),
        Instruction.createImmediate(1),
        Instruction.createOperation(Operation.CONSTANT, 4),
        Instruction.createImmediate(-2 >>> 0),
        // @loop:
        Instruction.createOperation(Operation.ADD, Register.R0, Register.R0, 2),
        Instruction.createOperation(Operation.NEQ, 3, Register.R0, 1),
        Instruction.createOperation(Operation.RJNZ, undefined, 3, 4),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(5);
  });

  test("nop: preserves registers", () => {
    return expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, Register.R0),
        Instruction.createImmediate(42),
        Instruction.createOperation(Operation.NOP),
        Instruction.createOperation(Operation.NOP),
        Instruction.createOperation(Operation.NOP),
        Instruction.createOperation(Operation.HALT),
      ])
    ).resolves.toBe(42);
  });

  test("int: unmapped handler faults", async () => {
    // INT with no handler mapped should fault
    await expect(
      run([
        Instruction.createOperation(Operation.CONSTANT, 1),
        Instruction.createImmediate(5),
        Instruction.createOperation(Operation.INT, undefined, 1),
        Instruction.createOperation(Operation.HALT),
      ])
    ).rejects.toThrow("fault");
  });

  describe("ClockPeripheral", () => {
    test("provides increasing time value", async () => {
      const clock = new ClockPeripheral();
      const vm = new VM({ peripherals: [clock] });

      const clockBase = 0x300;
      const result1Addr = 0x100; // Avoid peripheral table at 0x200
      const result2Addr = 0x101;

      // Program that reads clock twice with a small delay between
      const program = new Program([
        // Read clock value 1
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(clockBase),
        Instruction.createOperation(Operation.LOAD, 1, 0),

        // Store at result1
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(result1Addr),
        Instruction.createOperation(Operation.STORE, 0, 1),

        // Busy wait loop (spin for a bit)
        Instruction.createOperation(Operation.CONSTANT, 2),
        Instruction.createImmediate(50000),
        // @loop: (word 8)
        Instruction.createOperation(Operation.CONSTANT, 3),
        Instruction.createImmediate(1),
        Instruction.createOperation(Operation.SUB, 2, 2, 3),
        Instruction.createOperation(Operation.CONSTANT, 4),
        Instruction.createImmediate(8), // address of @loop (word 8)
        Instruction.createOperation(Operation.JNZ, undefined, 2, 4),

        // Read clock value 2
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(clockBase),
        Instruction.createOperation(Operation.LOAD, 1, 0),

        // Store at result2
        Instruction.createOperation(Operation.CONSTANT, 0),
        Instruction.createImmediate(result2Addr),
        Instruction.createOperation(Operation.STORE, 0, 1),

        Instruction.createOperation(Operation.HALT),
      ]);

      await vm.run(program.encode());

      const time1 = vm.dump(result1Addr, 1)[0];
      const time2 = vm.dump(result2Addr, 1)[0];

      // Second reading should be >= first (time advances or stays same if very fast)
      expect(time2).toBeGreaterThanOrEqual(time1);
    });
  });
});
