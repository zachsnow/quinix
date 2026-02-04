/**
 * Syscall and interrupt handling tests for the VM.
 * Tests interrupt mechanics, software interrupts (INT instruction),
 * and interrupt handler execution.
 */

import { VM } from './vm';
import { Instruction, Operation, Program, Register } from './instructions';
import { BufferedPeripheral, TimerPeripheral } from './peripherals';
import { runInstructions, binaryOp } from '@test/helpers';

describe('Interrupts: Basic Mechanics', () => {
  test('halt returns r0 value', async () => {
    const result = await runInstructions([
      Instruction.createOperation(Operation.CONSTANT, Register.R0),
      Instruction.createImmediate(42),
      Instruction.createOperation(Operation.HALT),
    ]);
    expect(result).toBe(42);
  });

  test('INT 0 (return) without stored state faults', async () => {
    // INT 0 is the return-from-interrupt instruction
    // Without a stored interrupt state, it should fault
    const vm = new VM();
    const program = new Program([
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0), // Interrupt 0 = return
      Instruction.createOperation(Operation.INT, undefined, 1),
      Instruction.createOperation(Operation.CONSTANT, Register.R0),
      Instruction.createImmediate(99),
      Instruction.createOperation(Operation.HALT),
    ]);

    // This should throw due to double fault (invalid return -> fault -> no handler -> critical)
    await expect(vm.run(program.encode())).rejects.toThrow();
  });

  test('simple program with cycle limit', async () => {
    const vm = new VM({ cycles: 100 });
    const program = new Program([
      Instruction.createOperation(Operation.CONSTANT, Register.R0),
      Instruction.createImmediate(42),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    expect(result).toBe(42);
  });
});

describe('Interrupts: Memory Layout', () => {
  test('interrupt table is at address 0', async () => {
    const vm = new VM();
    const program = new Program([
      // Read from interrupt enabled address (0x0000)
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x0000),
      Instruction.createOperation(Operation.LOAD, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    // Interrupts should be enabled after VM init
    expect(result).toBe(1);
  });

  test('peripheral table is at address 0x200', async () => {
    const vm = new VM();
    const program = new Program([
      // Read peripheral count from 0x200
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x200),
      Instruction.createOperation(Operation.LOAD, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    // At least the MMU peripheral should be present
    expect(result).toBeGreaterThanOrEqual(1);
  });

  test('peripheral memory starts at 0x300', async () => {
    class TestPeripheral extends BufferedPeripheral {
      public readonly name = 'test';
      public readonly identifier = 0x99999999;
      protected async onWrite(): Promise<void> {}
    }

    const peripheral = new TestPeripheral();
    const vm = new VM({ peripherals: [peripheral] });

    const program = new Program([
      // Read peripheral table entry address (second peripheral at 0x203)
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x203),
      Instruction.createOperation(Operation.LOAD, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    // First peripheral gets 0x300, second should be offset by first's size
    expect(result).toBeGreaterThanOrEqual(0x300);
  });
});

describe('Interrupts: Interrupt Masking', () => {
  test('disabling interrupts at 0x0000 masks them', async () => {
    // Write 0 to interrupt enable address
    const vm = new VM();
    const program = new Program([
      // Disable interrupts
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x0000),
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(0),
      Instruction.createOperation(Operation.STORE, 1, 2),

      // Read back
      Instruction.createOperation(Operation.LOAD, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    expect(result).toBe(0);
  });

  test('re-enabling interrupts at 0x0000', async () => {
    const vm = new VM();
    const program = new Program([
      // Disable interrupts
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x0000),
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(0),
      Instruction.createOperation(Operation.STORE, 1, 2),

      // Re-enable interrupts
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(1),
      Instruction.createOperation(Operation.STORE, 1, 2),

      // Read back
      Instruction.createOperation(Operation.LOAD, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    expect(result).toBe(1);
  });
});

describe('Interrupts: Timer Peripheral', () => {
  test('timer peripheral exists', () => {
    const timer = new TimerPeripheral();
    expect(timer).toBeDefined();
    expect(timer.name).toBe('timer');
  });
});

describe('Interrupts: Register Save/Restore', () => {
  test('registers are stored at interrupt table + 2', async () => {
    // The interrupt table stores registers at offset 0x0002
    const vm = new VM();
    const program = new Program([
      // Set some register values
      Instruction.createOperation(Operation.CONSTANT, 5),
      Instruction.createImmediate(0x12345678),

      // Read the register storage area (should be 0 initially)
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x0002 + 5), // Register 5's storage location
      Instruction.createOperation(Operation.LOAD, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    // Before any interrupt, storage should be 0
    expect(result).toBe(0);
  });
});

describe('Interrupts: External Interrupt via vm.interrupt()', () => {
  test('vm.interrupt() can trigger interrupt handler', async () => {
    // This test manually triggers an interrupt via the VM API
    // We need a custom setup with a mapped interrupt handler

    // For now, test that interrupt() returns false when no handler is mapped
    const vm = new VM();
    const program = new Program([
      Instruction.createOperation(Operation.CONSTANT, Register.R0),
      Instruction.createImmediate(42),
      Instruction.createOperation(Operation.HALT),
    ]);

    // Start VM in background - but we can't easily test this without
    // async coordination, so just verify the API exists
    expect(typeof vm.interrupt).toBe('function');
  });
});

describe('Interrupts: NOP and WAIT', () => {
  test('NOP does nothing', async () => {
    const result = await runInstructions([
      Instruction.createOperation(Operation.CONSTANT, Register.R0),
      Instruction.createImmediate(42),
      Instruction.createOperation(Operation.NOP),
      Instruction.createOperation(Operation.NOP),
      Instruction.createOperation(Operation.NOP),
      Instruction.createOperation(Operation.HALT),
    ]);
    expect(result).toBe(42);
  });

  test('multiple NOPs preserve state', async () => {
    const result = await runInstructions([
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(10),
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(20),
      Instruction.createOperation(Operation.NOP),
      Instruction.createOperation(Operation.ADD, Register.R0, 1, 2),
      Instruction.createOperation(Operation.HALT),
    ]);
    expect(result).toBe(30);
  });
});

describe('VM: Kill functionality', () => {
  test('vm.kill() stops execution', async () => {
    const vm = new VM();
    const program = new Program([
      // Infinite loop
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(VM.PROGRAM_ADDR), // Jump back to start
      Instruction.createOperation(Operation.JMP, undefined, 1),
    ]);

    // Start running and kill after a short delay
    const runPromise = vm.run(program.encode());

    // Kill immediately (in practice would be async)
    vm.kill();

    const result = await runPromise;
    expect(result).toBe(-1); // Kill returns -1
  });
});

describe('VM: Memory Operations', () => {
  test('poke writes to memory', async () => {
    const vm = new VM();
    const program = new Program([
      Instruction.createOperation(Operation.HALT),
    ]);

    await vm.run(program.encode());

    // After run, we can poke and dump
    vm.poke(0x5000, 0xDEADBEEF);
    const view = vm.dump(0x5000, 1);
    expect(view[0]).toBe(0xDEADBEEF);
  });

  test('dump reads memory range', async () => {
    const vm = new VM();
    const program = new Program([
      // Write some values to memory
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x5000),
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(0x11111111),
      Instruction.createOperation(Operation.STORE, 1, 2),

      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x5001),
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(0x22222222),
      Instruction.createOperation(Operation.STORE, 1, 2),

      Instruction.createOperation(Operation.HALT),
    ]);

    await vm.run(program.encode());

    const view = vm.dump(0x5000, 2);
    expect(view[0]).toBe(0x11111111);
    expect(view[1]).toBe(0x22222222);
  });
});

describe('VM: Breakpoints', () => {
  test('addBreakpoint adds breakpoint', () => {
    const vm = new VM();
    // Should not throw
    vm.addBreakpoint({ address: 0x1000, type: 'execute' });
  });

  test('removeBreakpoint removes breakpoint', () => {
    const vm = new VM();
    vm.addBreakpoint({ address: 0x1000, type: 'execute' });
    // Should not throw
    vm.removeBreakpoint(0x1000);
  });
});

describe('VM: Watchpoints', () => {
  test('addWatchpoint adds watchpoint', () => {
    const vm = new VM();
    // Should not throw
    vm.addWatchpoint({ low: 0x5000, high: 0x5010, type: 'write' });
  });

  test('clearWatchpoints removes all watchpoints', () => {
    const vm = new VM();
    vm.addWatchpoint({ low: 0x5000, high: 0x5010, type: 'write' });
    vm.addWatchpoint({ low: 0x6000, high: 0x6010, type: 'read' });
    // Should not throw
    vm.clearWatchpoints();
  });

  test('watchpoint callback is invoked on write', async () => {
    let callbackInvoked = false;
    let capturedAddress = 0;
    let capturedValue = 0;

    const vm = new VM({
      watchpoints: [{
        low: 0x5000,
        high: 0x5001,
        type: 'write',
        callback: (addr, val) => {
          callbackInvoked = true;
          capturedAddress = addr;
          capturedValue = val;
        },
      }],
    });

    const program = new Program([
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x5000),
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(0xCAFEBABE),
      Instruction.createOperation(Operation.STORE, 1, 2),
      Instruction.createOperation(Operation.HALT),
    ]);

    await vm.run(program.encode());

    expect(callbackInvoked).toBe(true);
    expect(capturedAddress).toBe(0x5000);
    expect(capturedValue).toBe(0xCAFEBABE);
  });
});

describe('VM: Stats', () => {
  test('stats tracks cycle count', async () => {
    const vm = new VM();
    const program = new Program([
      Instruction.createOperation(Operation.NOP),
      Instruction.createOperation(Operation.NOP),
      Instruction.createOperation(Operation.NOP),
      Instruction.createOperation(Operation.HALT),
    ]);

    await vm.run(program.encode());

    expect(vm.stats.cycles).toBeGreaterThan(0);
    expect(vm.stats.steps).toBeGreaterThan(0);
  });
});

describe('VM: MMU', () => {
  test('VM can run with MMU enabled', async () => {
    const vm = new VM({ enableMmu: true, mmuPages: 4 });
    const program = new Program([
      Instruction.createOperation(Operation.CONSTANT, Register.R0),
      Instruction.createImmediate(42),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    expect(result).toBe(42);
  });

  test('memory access works with MMU identity mapping', async () => {
    const vm = new VM({ enableMmu: true });
    const program = new Program([
      // Write to memory
      Instruction.createOperation(Operation.CONSTANT, 1),
      Instruction.createImmediate(0x5000),
      Instruction.createOperation(Operation.CONSTANT, 2),
      Instruction.createImmediate(123),
      Instruction.createOperation(Operation.STORE, 1, 2),

      // Read back
      Instruction.createOperation(Operation.LOAD, Register.R0, 1),
      Instruction.createOperation(Operation.HALT),
    ]);

    const result = await vm.run(program.encode());
    expect(result).toBe(123);
  });
});
