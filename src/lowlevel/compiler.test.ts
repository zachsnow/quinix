import { Register } from '../vm/instructions';
import { RegisterAllocator, Compiler } from './compiler';

describe('Register allocation', () => {
  test('allocates and deallocates', () => {
    const allocator = new RegisterAllocator();

    const r1 = allocator.allocate();
    expect(r1).toBe(1);
    const r2 = allocator.allocate();
    expect(r2).toBe(2);

    allocator.deallocate(r1);
    const r3 = allocator.allocate();
    expect(r3).toBe(1);

    expect(allocator.callerSave).toEqual([1, 2]);

    const r4 = allocator.allocate();
    allocator.deallocate(r2);
    allocator.deallocate(r3);

    expect(allocator.callerSave).toEqual([3]);
  });

  test('allocates correct registers', () => {
    const allocator = new RegisterAllocator();
    // We only allocate generic registers, and not those that the compiler treats as
    // special.
    for(let i = 0; i < Register.GENERIC_REGISTER_COUNT - Compiler.ReservedRegisters.length; i++){
      const r = allocator.allocate();
      expect(Register.genericRegisters.indexOf(Register.toString(r))).not.toBe(-1);
      expect(Compiler.ReservedRegisters.indexOf(r)).toBe(-1);
    }

    // And we can't allocate any more than that.
    expect(() => {
      const r = allocator.allocate();
      console.error('should not allocate', r);
    }).toThrowError();
  });
});

describe('Compiler', () => {
  test('correct registers', () => {
    expect(Compiler.CallerSaveRegisters.length).toBe(31);
    expect(Compiler.CalleeSaveRegisters.length).toBe(30);
  });
});
