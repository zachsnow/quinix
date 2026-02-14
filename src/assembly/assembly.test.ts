import { Operation } from "@/vm/instructions";
import { runQASM } from "@test/helpers";
import { Assembler, AssemblyProgram, Reference, TextData } from "./assembly";
import { parse } from "./parser";

describe("Reference", () => {
  test("uses @", () => {
    expect(new Reference("ref").toString()).toBe("@ref");
  });

  test("sets address when preassembling", () => {
    const assembler = new Assembler();
    const ref = new Reference("ref");
    ref.preassemble(assembler, 0x10);
    expect(assembler.addressTable.get("ref").value).toBe(0x10);
  });

  test("assembles to its address", () => {
    const assembler = new Assembler();
    const ref = new Reference("ref");
    assembler.addressTable.set("ref", 0x10);

    const instructions = ref.assemble(assembler);
    expect(instructions).not.toBeUndefined();
    expect(instructions!.length).toBe(1);
    expect(instructions![0].immediate).toBe(
      assembler.programSectionBase + 0x10
    );
  });

  test("does not assemble unknown", () => {
    const assembler = new Assembler();
    const ref = new Reference("ref");
    assembler.addressTable.set("another_ref", 0x10);

    const instructions = ref.assemble(assembler);
    expect(instructions).toBeUndefined();
  });

  test("single-char identifiers round-trip as unquoted", () => {
    expect(new Reference("a").toString()).toBe("@a");
    expect(new Reference("_").toString()).toBe("@_");
  });

  test("qualified identifiers with single-char segments", () => {
    expect(new Reference("a::b").toString()).toBe("@a::b");
  });
});

describe("Data", () => {
  test("escape", () => {
    expect(TextData.escape("ab c")).toBe("ab c");
    expect(TextData.escape("a b'c")).toBe("a b\\'c");
    expect(TextData.escape("a b\nc")).toBe("a b\\nc");
    expect(TextData.escape("a b\\nc")).toBe("a b\\\\nc");
  });
});

describe("Assembler", () => {
  test("assembles labels correctly", () => {
    const programText = `
      @foo:
      @bar:
    `;
    const assemblyProgram: AssemblyProgram = parse(programText);
    const [messages, program] = assemblyProgram.assemble();
    if (!program) {
      throw new Error(messages.toString() || "internal error");
    }
    expect(program.instructions.length).toBe(4);
    expect(program.instructions[0].operation).toBe(Operation.HALT);
    expect(program.instructions[1].operation).toBe(Operation.HALT);
  });

  test("unknown references error", () => {
    const programText = `
      mov r2 r1
      constant r1 @foo;
      @bar:
      constant r3 0
    `;
    const assemblyProgram: AssemblyProgram = parse(programText);
    const [messages, program] = assemblyProgram.assemble();
    expect(messages.errors.map((e) => e.text)).toContain(
      "unknown reference @foo"
    );
    expect(program).toBeUndefined();
  });

  test("assembles instructions correctly", () => {
    const instructionTexts = Operation.specifications
      .map((spec) => {
        // Don't include constant.
        if (spec.name === "constant") {
          return;
        }

        const args = [spec.name];
        if (spec.d) {
          args.push("r1");
        }
        if (spec.s0) {
          args.push("r2");
        }
        if (spec.s1) {
          args.push("r3");
        }
        return args.join(" ");
      })
      .filter((i): i is string => !!i);
    const programText = instructionTexts.join("\n");

    const assemblyProgram: AssemblyProgram = parse(programText);

    // Each instruction directive should assemble to a single instruction, "itself".
    // These come before the sentinel, so only check the first ones.
    const [messages, program] = assemblyProgram.assemble();
    expect(messages.errors.length).toBe(0);
    expect(program).not.toBeUndefined();
    instructionTexts.forEach((instructionText, i) => {
      const instruction = program!.instructions[i];
      expect(instruction.toString()).toBe(instructionText);
    });

    // Hand-check a few.
    expect(instructionTexts[Operation.HALT]).toBe("halt");
    expect(program!.instructions[Operation.HALT].toString()).toBe("halt");
    expect(instructionTexts[Operation.LOAD]).toBe("load r1 r2");
    expect(program!.instructions[Operation.LOAD].toString()).toBe("load r1 r2");
  });

  test("duplicate labels produce error", () => {
    const programText = `
      @foo:
      @foo:
    `;
    const assemblyProgram: AssemblyProgram = parse(programText);
    const [messages, program] = assemblyProgram.assemble();
    expect(program).toBeUndefined();
    expect(messages.errors.some((e) => e.text.includes("duplicate"))).toBe(true);
  });

  test("concat merges directives", () => {
    const a = AssemblyProgram.parse("halt");
    const b = AssemblyProgram.parse("nop");
    const combined = AssemblyProgram.concat([a, b]);
    expect(combined.directives.length).toBe(2);
  });

  test("data with references", () => {
    const programText = `
      data @foo 0x42
      data @bar @foo
      constant r0 @bar
      halt
    `;
    const assemblyProgram: AssemblyProgram = parse(programText);
    const [messages, program] = assemblyProgram.assemble();
    expect(messages.errors.length).toBe(0);
    expect(program).not.toBeUndefined();
  });
});

describe("Relative jumps", () => {
  test("rjmp forward skips instructions", async () => {
    // r0 = 3 (offset: skip over constant+imm = 2 words, + 1 for the rjmp itself? No:
    // rjmp adds offset to its own IP, then ipOffset=0, so IP = IP_of_rjmp + offset.
    // After constants: r0=3, we're at word 4 (0-indexed from program start).
    // rjmp is at word 4. We want to skip constant r1 0xDEAD (2 words) to reach halt at word 7.
    // offset = 3 (skip rjmp word + 2 words of constant).
    // Actually: IP_of_rjmp + 3 = 4+3 = 7 which is the halt.
    const result = await runQASM(`
      constant r0 0
      constant r1 3
      rjmp r1
      constant r0 0xDEAD
      halt
    `);
    expect(result).toBe(0);
  });

  test("rjnz backward loop counts to 5", async () => {
    // r0 = counter, r1 = 1, r2 = limit (5), r3 = offset (-2 as unsigned)
    // Layout: constants at words 0-7, add at 8, sub at 9, rjnz at 10.
    // rjnz at IP=10, offset=-2 (0xFFFFFFFE), target=10+(-2)=8 (the add).
    const result = await runQASM(`
      constant r0 0
      constant r1 1
      constant r2 5
      constant r3 0xFFFFFFFE
      add r0 r0 r1
      sub r2 r2 r1
      rjnz r2 r3
      halt
    `);
    expect(result).toBe(5);
  });

  test("rjz taken vs not-taken", async () => {
    // When r0=0, rjz should jump; when r0!=0, it should not.
    // Taken: r0=0, offset=2 skips constant r0 0xFF to reach halt.
    const taken = await runQASM(`
      constant r0 0
      constant r1 2
      rjz r0 r1
      constant r0 0xFF
      halt
    `);
    expect(taken).toBe(0);

    // Not taken: r0=1, falls through to set r0=0xFF.
    const notTaken = await runQASM(`
      constant r0 1
      constant r1 2
      rjz r0 r1
      constant r0 0xFF
      halt
    `);
    expect(notTaken).toBe(0xFF);
  });
});
