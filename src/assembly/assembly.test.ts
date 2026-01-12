import { Reference, Assembler, AssemblyProgram, TextData } from './assembly';
import { parse } from './parser';
import { VM, } from '../vm/vm';
import { Operation, Instruction } from '../vm/instructions';

describe('Reference', () => {
  test('uses @', () => {
    expect(new Reference('ref').toString()).toBe('@ref');
  });

  test('sets address when preassembling', () => {
    const assembler = new Assembler();
    const ref = new Reference('ref');
    ref.preassemble(assembler, 0x10);
    expect(assembler.addressTable.get('ref').value).toBe(0x10);
  });

  test('assembles to its address', () => {
    const assembler = new Assembler();
    const ref = new Reference('ref');
    assembler.addressTable.set('ref', 0x10);

    const instructions = ref.assemble(assembler);
    expect(instructions).not.toBeUndefined();
    expect(instructions!.length).toBe(1);
    expect(instructions![0].immediate).toBe(assembler.programSectionBase + 0x10);
  });

  test('does not assemble unknown', () => {
    const assembler = new Assembler();
    const ref = new Reference('ref');
    assembler.addressTable.set('another_ref', 0x10);

    const instructions = ref.assemble(assembler);
    expect(instructions).toBeUndefined();
  });
});

describe('Data', () => {
  test('escape', () => {
    expect(TextData.escape('ab c')).toBe('ab c');
    expect(TextData.escape("a b'c")).toBe("a b\\'c");
    expect(TextData.escape("a b\nc")).toBe("a b\\nc");
    expect(TextData.escape("a b\\nc")).toBe("a b\\\\nc");
  });
});

describe('Assembler', () => {
  test('assembles labels correctly', () => {
    const programText = `
      @foo:
      @bar:
    `;
    const assemblyProgram: AssemblyProgram = parse(programText);
    const [ messages, program ] = assemblyProgram.assemble();
    if(!program){
      throw new Error(messages.toString() || 'internal error')
    }
    expect(program.instructions.length).toBe(4);
    expect(program.instructions[0].operation).toBe(Operation.HALT);
    expect(program.instructions[1].operation).toBe(Operation.HALT);
  });

  test('unknown references error', () => {
    const programText = `
      mov r2 r1
      constant r1 @foo;
      @bar:
      constant r3 0
    `;
    const assemblyProgram: AssemblyProgram = parse(programText);
    const [ messages, program ] = assemblyProgram.assemble();
    expect(messages.errors.map((e) => e.text)).toContain('unknown reference @foo');
    expect(program).toBeUndefined();
  });

  test('assembles instructions correctly', () => {
    const instructionTexts = Operation.specifications.map((spec) => {
      // Don't include constant.
      if(spec.name === 'constant'){
        return;
      }

      const args = [ spec.name ];
      if(spec.d){
        args.push('r1');
      }
      if(spec.s0){
        args.push('r2');
      }
      if(spec.s1){
        args.push('r3');
      }
      return args.join(' ');
    }).filter((i): i is string => !!i);
    const programText = instructionTexts.join('\n');

    const assemblyProgram: AssemblyProgram = parse(programText);

    // Each instruction directive should assemble to a single instruction, "itself".
    // These come before the sentinel, so only check the first ones.
    const [messages, program ] = assemblyProgram.assemble();
    expect(messages.errors.length).toBe(0);
    expect(program).not.toBeUndefined();
    instructionTexts.forEach((instructionText, i) => {
      const instruction = program!.instructions[i];
      expect(instruction.toString()).toBe(instructionText);
    });

    // Hand-check a few.
    expect(instructionTexts[Operation.HALT]).toBe('halt');
    expect(program!.instructions[Operation.HALT].toString()).toBe('halt');
    expect(instructionTexts[Operation.LOAD]).toBe('load r1 r2');
    expect(program!.instructions[Operation.LOAD].toString()).toBe('load r1 r2');
  });
});
