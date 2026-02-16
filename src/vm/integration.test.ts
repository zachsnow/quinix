/**
 * Assembly-based integration tests for the VM.
 * Uses QASM source for readable multi-instruction programs.
 */

import { runQASM, assembleQASM } from "@test/helpers";
import { VM } from "./vm";

describe("Integration: multi-instruction sequences", () => {
  test("loop counting to 10", async () => {
    const result = await runQASM(`
      ; Count to 10: r0 = counter, r1 = target, r2 = 1
      constant r0 0
      constant r1 10
      constant r2 1
      @loop:
        add r0 r0 r2
        neq r3 r0 r1
        constant r4 @loop
      jnz r3 r4
      halt
    `, { cycles: 500 });
    expect(result).toBe(10);
  });

  test("fibonacci: fib(10) = 55", async () => {
    const result = await runQASM(`
      ; Compute fib(10) = 55
      ; r0=a (prev), r1=b (curr), r2=counter, r3=target, r4=1
      constant r0 0
      constant r1 1
      constant r2 0
      constant r3 10
      constant r4 1
      @loop:
        add r5 r0 r1
        mov r0 r1
        mov r1 r5
        add r2 r2 r4
        neq r6 r2 r3
        constant r7 @loop
      jnz r6 r7
      ; After 10 iterations: r0=fib(10)=55, r1=fib(11)=89
      halt
    `, { cycles: 500 });
    expect(result).toBe(55);
  });

  test("memory copy", async () => {
    const result = await runQASM(`
      ; Write 3 words to 0x2000, copy to 0x3000, read back last one
      constant r0 0x2000
      constant r1 0xAA
      store r0 r1
      constant r0 0x2001
      constant r1 0xBB
      store r0 r1
      constant r0 0x2002
      constant r1 0xCC
      store r0 r1

      ; Copy loop: r2=src, r3=dst, r4=count, r5=1
      constant r2 0x2000
      constant r3 0x3000
      constant r4 3
      constant r5 1
      @copy:
        load r6 r2
        store r3 r6
        add r2 r2 r5
        add r3 r3 r5
        sub r4 r4 r5
        constant r7 @copy
      jnz r4 r7

      ; Read back last copied word
      constant r0 0x3002
      load r0 r0
      halt
    `, { cycles: 500 });
    expect(result).toBe(0xCC);
  });

  test("stack push/pop round-trip", async () => {
    const result = await runQASM(`
      ; Simulate stack at 0x4000 using r10 as stack pointer
      constant r10 0x4000
      constant r1 1

      ; Push 42
      constant r2 42
      sub r10 r10 r1
      store r10 r2

      ; Push 99
      constant r2 99
      sub r10 r10 r1
      store r10 r2

      ; Pop into r3 (should be 99)
      load r3 r10
      add r10 r10 r1

      ; Pop into r4 (should be 42)
      load r4 r10
      add r10 r10 r1

      ; Verify: r0 = r3 + r4 = 99 + 42 = 141
      add r0 r3 r4
      halt
    `, { cycles: 500 });
    expect(result).toBe(141);
  });

  test("bitwise chain: AND/OR/NOT/SHL/SHR", async () => {
    const result = await runQASM(`
      constant r0 0xFF00
      constant r1 0x0FF0
      and r2 r0 r1       ; 0x0F00
      constant r3 0x000F
      or r2 r2 r3        ; 0x0F0F
      constant r4 4
      shl r2 r2 r4       ; 0xF0F0
      shr r2 r2 r4       ; 0x0F0F
      not r2 r2          ; 0xFFFFF0F0
      constant r5 0xFFFF
      and r0 r2 r5       ; 0xF0F0
      halt
    `, { cycles: 500 });
    expect(result).toBe(0xF0F0);
  });

  test("float computation: FMUL/FADD/FTOI pipeline", async () => {
    // Compute (2.0 * 3.0) + 4.0 = 10.0, then convert to int
    const result = await runQASM(`
      ; Float bit patterns: 2.0=0x40000000, 3.0=0x40400000, 4.0=0x40800000
      constant r1 0x40000000
      constant r2 0x40400000
      fmul r3 r1 r2      ; r3 = 6.0
      constant r4 0x40800000
      fadd r3 r3 r4      ; r3 = 10.0
      ftoi r0 r3          ; r0 = 10
      halt
    `, { cycles: 500 });
    expect(result).toBe(10);
  });
});

describe("Integration: interrupt lifecycle", () => {
  test("software interrupt dispatches to handler", async () => {
    // Install a handler for interrupt 2 that halts with a sentinel value.
    // Trigger via INT, verify handler runs.
    const result = await runQASM(`
      ; --- Write handler at 0x500: constant r0 0xBEEF / halt ---
      constant r10 0x500
      constant r11 0x05000000    ; constant r0
      store r10 r11
      constant r10 0x501
      constant r11 0xBEEF
      store r10 r11
      constant r10 0x502
      constant r11 0x00000000    ; halt
      store r10 r11

      ; --- Set up interrupt table ---
      constant r1 0x01
      load r3 r1                 ; r3 = entries table address
      constant r4 0x2
      add r3 r3 r4              ; entries[2]
      constant r2 0x500
      store r3 r2

      constant r1 0x44
      constant r2 0x2
      store r1 r2                ; handler count = 2

      ; --- Trigger interrupt 2 ---
      constant r1 2
      int r1

      ; Should never reach here
      constant r0 0xFF
      halt
    `, { cycles: 500 });
    expect(result).toBe(0xBEEF);
  });

  test("interrupt return restores registers", async () => {
    // Install a handler that returns via int r5 (r5=0).
    // Set r0=0xDEAD before triggering, verify r0 is restored after return.
    const result = await runQASM(`
      ; --- Handler at 0x500: set r5=0, int r5 (return) ---
      ; constant r5 0
      constant r10 0x500
      constant r11 0x05050000    ; constant r5
      store r10 r11
      constant r10 0x501
      constant r11 0x00000000    ; immediate 0
      store r10 r11
      ; int r5
      constant r10 0x502
      constant r11 0x01000500    ; int sr0=r5
      store r10 r11

      ; --- Set up interrupt table ---
      constant r1 0x01
      load r3 r1
      constant r4 0x2
      add r3 r3 r4
      constant r2 0x500
      store r3 r2

      constant r1 0x44
      constant r2 0x2
      store r1 r2

      ; --- Set r0 = 0xDEAD, trigger interrupt, verify restore ---
      constant r0 0xDEAD
      constant r1 2
      int r1

      ; After return, r0 should be restored to 0xDEAD
      halt
    `, { cycles: 500 });
    expect(result).toBe(0xDEAD);
  });

  test("fault handler: out-of-bounds load triggers fault with reason", async () => {
    const result = await runQASM(`
      ; Write fault handler at 0x500: read fault reason and halt with it
      constant r1 0x500
      constant r2 0x05000000    ; constant r0 ...
      store r1 r2
      constant r1 0x501
      constant r2 0x43          ; fault reason address
      store r1 r2
      constant r1 0x502
      constant r2 0x02000000    ; load r0 r0
      store r1 r2
      constant r1 0x503
      constant r2 0x00000000    ; halt
      store r1 r2

      ; Set up interrupt table: fault handler (interrupt 1) at 0x500
      constant r1 0x01
      load r3 r1
      constant r4 0x1
      add r3 r3 r4
      constant r2 0x500
      store r3 r2

      constant r1 0x44
      constant r2 0x1
      store r1 r2

      ; Trigger fault: load from way beyond physical memory
      constant r1 0x7FFFFFFF
      load r0 r1
    `, { cycles: 200 });
    expect(result).toBe(0x04); // OUT_OF_BOUNDS
  });

  test("WAIT/resume: external interrupt wakes VM from WAIT", async () => {
    // The handler halts directly with a sentinel, proving the interrupt
    // woke the VM and dispatched the handler.
    const assembled = assembleQASM(`
      ; --- Handler at 0x500: constant r0 42 / halt ---
      constant r10 0x500
      constant r11 0x05000000    ; constant r0
      store r10 r11
      constant r10 0x501
      constant r11 42
      store r10 r11
      constant r10 0x502
      constant r11 0x00000000    ; halt
      store r10 r11

      ; Map interrupt 2 to 0x500
      constant r1 0x01
      load r3 r1
      constant r4 0x2
      add r3 r3 r4
      constant r2 0x500
      store r3 r2

      constant r1 0x44
      constant r2 0x2
      store r1 r2

      ; WAIT for interrupt
      wait

      ; Should not reach here (handler halts)
      constant r0 0xFF
      halt
    `);

    expect(assembled.success).toBe(true);

    const vm = new VM({ cycles: 50_000_000 });

    // Fire interrupt after a short delay to wake VM from WAIT.
    // The VM idles in a cycle-advancing loop until release() yields
    // to the event loop, allowing this setTimeout to fire.
    setTimeout(() => {
      vm.interrupt(2);
    }, 50);

    const result = await vm.run(assembled.binary!);
    expect(result).toBe(42);
  });
});

describe("Integration: MMU fault", () => {
  test("write to read-only page triggers fault handler", async () => {
    // Use enableMmu with 2 pages (identity-mapped). Modify page 1's flags
    // to remove Write permission, then attempt a write. The fault handler
    // should fire with MEMORY_FAULT reason.
    const assembled = assembleQASM(`
      ; --- Fault handler at 0x500: read fault reason, halt with it ---
      constant r1 0x500
      constant r2 0x05000000    ; constant r0
      store r1 r2
      constant r1 0x501
      constant r2 0x43          ; fault reason address
      store r1 r2
      constant r1 0x502
      constant r2 0x02000000    ; load r0 r0
      store r1 r2
      constant r1 0x503
      constant r2 0x00000000    ; halt
      store r1 r2

      ; --- Set up interrupt table for fault (interrupt 1) ---
      constant r1 0x01
      load r3 r1
      constant r4 0x1
      add r3 r3 r4
      constant r2 0x500
      store r3 r2
      constant r1 0x44
      constant r2 0x1
      store r1 r2

      ; --- Remove Write flag from page 1 ---
      ; Page table at 0x80: [count] [page0: vaddr,paddr,size,flags] [page1: vaddr,paddr,size,flags]
      ; Page 1 flags at 0x80 + 1 + 4 + 3 = 0x88
      ; Current flags = 0xF (Present|Read|Write|Execute)
      ; New flags = 0xB (Present|Read|Execute, no Write)
      constant r1 0x88
      constant r2 0x0B
      store r1 r2

      ; --- Notify MMU to rebuild: store page table base to MMU IO at 0x300 ---
      constant r1 0x300
      constant r2 0x80
      store r1 r2

      ; --- Attempt write to page 1 (address 0x200000) - should fault ---
      constant r1 0x200000
      constant r2 0xDEAD
      store r1 r2

      ; Should not reach here
      halt
    `);

    expect(assembled.success).toBe(true);

    const vm = new VM({ enableMmu: true, mmuPages: 2, cycles: 500 });
    const result = await vm.run(assembled.binary!);
    expect(result).toBe(0x03); // MEMORY_FAULT
  });
});
