import { IdentityMMU, AccessFlags, TwoLevelPageTablePeripheral, ListPageTablePeripheral } from './mmu';
import { Memory } from '../lib/base-types';
import { VM } from './vm';
import type { PeripheralMapping } from './peripheral-base';

describe('MMU', () => {

  describe('identity', () => {
    test('enabled', () => {
      const mmu = new IdentityMMU();
      mmu.enable();
      expect(mmu.translate(0x100, AccessFlags.Execute)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Write)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Read)).toBe(0x100);
    });

    test('disabled"', () => {
      const mmu = new IdentityMMU();
      mmu.disable();
      expect(mmu.translate(0x100, AccessFlags.Execute)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Write)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Read)).toBe(0x100);
    });
  });

  describe('simple list-based page table', () => {
    function create(size: number = 0x200){
      const memory = new Memory(size);
      memory.fill(0);

      const view = memory.createView(size / 2, size / 2);
      return {
        memory,
        view,
      }
    }

    test('disabled', () => {
      const { memory, view } = create();
      const mmu = new ListPageTablePeripheral(memory);
      mmu.disable();

      expect(mmu.translate(0x100, AccessFlags.Execute)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Write)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Read)).toBe(0x100);
    });

    test('unmapped', () => {
      const { memory, view } = create();
      const mmu = new ListPageTablePeripheral(memory);
      mmu.enable();

      // No mapping.
      view[0] = 0x0;

      expect(mmu.translate(0x100, AccessFlags.Execute)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Write)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Read)).toBe(0x100);
    });

    test('simple mapping', () => {
      const { memory, view } = create(0x2000);
      const mmu = new ListPageTablePeripheral(memory);
      const vm = new VM();
      const mapping: PeripheralMapping = {
        base: 0x100,
        peripheral: mmu,
        view: view,
      };
      mmu.map(vm, mapping);
      mmu.enable();

      // Simple mapping:
      memory[0x10] = 2;
      memory[0x11] = 0x500;
      memory[0x12] = 0x700;
      memory[0x13] = 0x100;
      memory[0x14] = AccessFlags.Present | AccessFlags.Read;

      memory[0x15] = 0x600;
      memory[0x16] = 0x400;
      memory[0x17] = 0x100;
      memory[0x18] = AccessFlags.Present | AccessFlags.Read | AccessFlags.Execute;

      view[0] = 0x10;
      mmu.notify(0);

      expect(mmu.translate(0x505, AccessFlags.Read)).toBe(0x705);
      expect(mmu.translate(0x505, AccessFlags.Execute)).toBe(undefined);
      expect(mmu.translate(0x606, AccessFlags.Read)).toBe(0x406);
      expect(mmu.translate(0x606, AccessFlags.Execute)).toBe(0x406);
      expect(mmu.translate(0x606, AccessFlags.Write)).toBe(undefined);
    });
  });

  describe('2-level page table', () => {
    function create(size: number = 0x200){
      const memory = new Memory(size);
      memory.fill(0);

      const view = memory.createView(size / 2, size / 2);
      return {
        memory,
        view,
      }
    }

    test('disabled', () => {
      const { memory, view } = create();
      const mmu = new TwoLevelPageTablePeripheral(memory);
      mmu.disable();

      expect(mmu.translate(0x100, AccessFlags.Execute)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Write)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Read)).toBe(0x100);
    });

    test('unmapped', () => {
      const { memory, view } = create();
      const mmu = new TwoLevelPageTablePeripheral(memory);
      mmu.enable();

      // No mapping.
      view[0] = 0x0;

      expect(mmu.translate(0x100, AccessFlags.Execute)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Write)).toBe(0x100);
      expect(mmu.translate(0x100, AccessFlags.Read)).toBe(0x100);
    });

    test('simple mapping', () => {
      const { memory, view } = create(0x2000);
      const mmu = new TwoLevelPageTablePeripheral(memory);
      const vm = new VM();
      const mapping: PeripheralMapping = {
        base: 0x100,
        peripheral: mmu,
        view: view,
      }
      mmu.map(vm, mapping);
      mmu.enable();

      // Simple mapping:
      view[0] = 0x10;
      mmu.notify(0);

      // Table 1.
      memory[0x10] = (0x12 << 4) | AccessFlags.Present | AccessFlags.Read;
      memory[0x11] = (0x13 << 4) | AccessFlags.Present | AccessFlags.Read;

      // Table 2.
      memory[0x12] = (0x1 << 12) | AccessFlags.Present | AccessFlags.Read; // Map low addresses high.
      memory[0x13] = (0x0 << 12) | AccessFlags.Present | AccessFlags.Read; // Map high addresses low.

      // Set values.
      memory[0x20] = 0x42;
      memory[0x1020] = 0x24;

      // Low addresses map high.
      expect(mmu.translate(0x0020, AccessFlags.Read)).toBe(0x1020);
      mmu.reset();
      expect(memory[mmu.translate(0x0020, AccessFlags.Read)!]).toBe(0x24);
      mmu.reset();
      expect(mmu.translate(0x0020, AccessFlags.Write)).toBeUndefined();
      mmu.reset();

      // High addresses map low.
      expect(mmu.translate(0x1020, AccessFlags.Read)).toBe(0x20);
      mmu.reset();
      expect(memory[mmu.translate(0x1020, AccessFlags.Read)!]).toBe(0x42);
      mmu.reset();
      expect(mmu.translate(0x1020, AccessFlags.Write)).toBeUndefined();
      mmu.reset();
    });
  });
});
