import { Operation } from "@/vm/instructions";
import { AssemblyProgram, ConstantDirective, DataDirective } from "./assembly";
import { parse } from "./parser";
import { floatToInt } from "@test/helpers";

describe("Parser", () => {
  test("Data directives", () => {
    let assemblyProgram = AssemblyProgram.parse(`data @foo 0x0`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(DataDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`data @foo 0x00`);

    assemblyProgram = AssemblyProgram.parse(`data @foo 0x0 0x1 0x2`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(DataDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(
      `data @foo 0x00 0x01 0x02`
    );

    assemblyProgram = AssemblyProgram.parse(`data @foo 'This is a string!\\n'`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(DataDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(
      `data @foo 'This is a string!\\n'`
    );

    assemblyProgram = AssemblyProgram.parse(`data @foo @bar`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(DataDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`data @foo @bar`);
  });

  test("Constant directives", () => {
    let assemblyProgram = AssemblyProgram.parse(`constant r0 0x10`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(ConstantDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`constant r0 0x0010`);

    assemblyProgram = AssemblyProgram.parse(`constant r0 @foo`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(ConstantDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`constant r0 @foo`);
  });

  test("Float literals", () => {
    // Assemble and check the immediate value (second word after constant instruction)
    // Use >>> 0 to ensure unsigned comparison
    // Basic float
    let assemblyProgram = AssemblyProgram.parse(`constant r0 3.14f`);
    let [, program] = assemblyProgram.assemble();
    expect(program!.instructions[1].immediate! >>> 0).toBe(floatToInt(3.14));

    // Negative float
    assemblyProgram = AssemblyProgram.parse(`constant r0 -1.5f`);
    [, program] = assemblyProgram.assemble();
    expect(program!.instructions[1].immediate! >>> 0).toBe(floatToInt(-1.5));

    // Float with exponent
    assemblyProgram = AssemblyProgram.parse(`constant r0 1.5e2f`);
    [, program] = assemblyProgram.assemble();
    expect(program!.instructions[1].immediate! >>> 0).toBe(floatToInt(150.0));

    // Float with negative exponent
    assemblyProgram = AssemblyProgram.parse(`constant r0 1.5e-2f`);
    [, program] = assemblyProgram.assemble();
    expect(program!.instructions[1].immediate! >>> 0).toBe(floatToInt(0.015));

    // Integer with exponent (also a float)
    assemblyProgram = AssemblyProgram.parse(`constant r0 1e3f`);
    [, program] = assemblyProgram.assemble();
    expect(program!.instructions[1].immediate! >>> 0).toBe(floatToInt(1000.0));
  });

  test("All instructions parse correctly", () => {
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

    // Should have the correct number of directives.
    expect(assemblyProgram.directives.length).toBe(instructionTexts.length);

    // Hand-check a few.
    expect(instructionTexts[Operation.HALT]).toBe("halt");
    expect(assemblyProgram.directives[Operation.HALT].toString()).toBe("halt");
    expect(instructionTexts[Operation.LOAD]).toBe("load r1 r2");
    expect(assemblyProgram.directives[Operation.LOAD].toString()).toBe(
      "load r1 r2"
    );

    // The assembly should be the same.
    assemblyProgram.directives.forEach((directive, i) => {
      expect(directive.toString()).toBe(instructionTexts[i]);
    });
  });
});
