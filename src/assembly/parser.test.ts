import { Reference, AddressTable, AssemblyProgram, DataDirective, ConstantDirective } from './assembly';
import { parse } from './parser';
import { VM, } from '../vm/vm';
import { Operation } from '../vm/instructions';

describe('Parser', () => {
  test('Data directives', () => {
    let assemblyProgram = AssemblyProgram.parse(`data @foo 0x0`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(DataDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`data @foo 0x00`);

    assemblyProgram = AssemblyProgram.parse(`data @foo 0x0 0x1 0x2`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(DataDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`data @foo 0x00 0x01 0x02`);

    assemblyProgram = AssemblyProgram.parse(`data @foo 'This is a string!\\n'`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(DataDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`data @foo 'This is a string!\\n'`);

    assemblyProgram = AssemblyProgram.parse(`data @foo @bar`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(DataDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`data @foo @bar`);
  });

  test('Constant directives', () => {
    let assemblyProgram = AssemblyProgram.parse(`constant r0 0x10`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(ConstantDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`constant r0 0x0010`);

    assemblyProgram = AssemblyProgram.parse(`constant r0 @foo`);
    expect(assemblyProgram.directives.length).toBe(1);
    expect(assemblyProgram.directives[0]).toBeInstanceOf(ConstantDirective);
    expect(assemblyProgram.directives[0].toString()).toBe(`constant r0 @foo`);
  });

  test('All instructions parse correctly', () => {
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

    // Should have the correct number of directives.
    expect(assemblyProgram.directives.length).toBe(instructionTexts.length);

    // Hand-check a few.
    expect(instructionTexts[Operation.HALT]).toBe('halt');
    expect(assemblyProgram.directives[Operation.HALT].toString()).toBe('halt');
    expect(instructionTexts[Operation.LOAD]).toBe('load r1 r2');
    expect(assemblyProgram.directives[Operation.LOAD].toString()).toBe('load r1 r2');

    // The assembly should be the same.
    assemblyProgram.directives.forEach((directive, i) => {
      expect(directive.toString()).toBe(instructionTexts[i]);
    });
  });
});
