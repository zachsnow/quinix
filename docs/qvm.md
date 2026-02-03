# Quinix Virtual Machine

The Quinix Virtual Machine (QVM) is a 32-bit virtual machine that executes binary programs compiled from [QASM](./qasm.md).

## Architecture Overview

The VM consists of several components:

- **CPU** - Executes instructions (see [QPU](./qpu.md))
- **Memory** - Linear address space of configurable size (default 1MB)
- **MMU** - Virtual-to-physical address translation with page protection
- **Peripherals** - Hardware devices mapped via DMA

## Memory Layout

The VM's physical memory is organized with reserved regions at low addresses:

```
0x0000 - 0x00FF  Interrupt table
0x0100 - 0x01FF  Interrupt handler code
0x0200 - 0x02FF  Peripheral table
0x0300 - ...     Peripheral mappings
0x1000 - ...     Program load address
```

### Interrupt Table (0x0000)

| Offset | Field | Description |
|--------|-------|-------------|
| 0x00 | enabled | Interrupts enabled flag (0 = disabled, 1 = enabled) |
| 0x01 | entries_addr | Address of handler entries table |
| 0x02 | registers[0..63] | Saved register state during interrupt |
| 0x42 | count | Number of mapped interrupt handlers |
| 0x43+ | entries[] | Handler addresses (indexed by interrupt number) |

### Peripheral Table (0x0200)

| Offset | Field | Description |
|--------|-------|-------------|
| 0x00 | count | Number of mapped peripherals |
| 0x01+ | entries[] | Pairs of (identifier, base_address) |

## Boot Sequence

1. **Zero memory** - All memory cleared, MMU disabled
2. **Map peripherals** - Peripherals assigned contiguous memory regions starting at 0x0300
3. **Map interrupts** - Interrupt handlers written to 0x0100+, entries table populated
4. **Load program** - Binary loaded at 0x1000
5. **Start execution** - IP set to 0x1000, execution begins

## Interrupt Handling

When an interrupt occurs:

1. Interrupts are disabled (enabled = 0)
2. MMU is disabled (physical addressing)
3. All registers saved to interrupt table
4. IP jumps to handler address

When returning from an interrupt (interrupt 0x0):

1. Registers restored from interrupt table
2. MMU re-enabled
3. Interrupts re-enabled
4. Execution resumes at saved IP

### Reserved Interrupts

| Interrupt | Name | Description |
|-----------|------|-------------|
| 0x0 | RETURN | Return from interrupt handler |
| 0x1 | FAULT | Memory fault or invalid operation |

### Fault Handling

Faults trigger interrupt 0x1. If a fault occurs while handling another interrupt, the fault handler replaces the current handler. A double fault (fault during fault handling) terminates the VM.

## Memory Management Unit

The MMU translates virtual addresses to physical addresses with access protection. See [QPU Peripherals](./qpu.md#mmu-peripherals) for MMU peripheral documentation.

### Access Flags

| Flag | Bit | Description |
|------|-----|-------------|
| Present | 0x1 | Page is mapped |
| Read | 0x2 | Page is readable |
| Write | 0x4 | Page is writable |
| Execute | 0x8 | Page is executable |

Memory accesses that violate page permissions trigger a fault.

## Execution

The VM executes in a loop:

1. Fetch instruction at IP (virtual address)
2. Translate IP through MMU with Execute flag
3. Decode and execute instruction
4. Advance IP (unless jump/interrupt)
5. Periodically yield to allow peripheral async operations

The VM halts when:
- `halt` instruction executes (returns r0)
- `wait` instruction executes (waits for next interrupt)
- Unhandled fault occurs
- Maximum cycle count exceeded

## Peripheral System

Peripherals are memory-mapped devices. Each peripheral reserves:
- **IO bytes** - Writes trigger `notify()` on the peripheral
- **Shared bytes** - Regular memory for data exchange

See [QPU Peripherals](./qpu.md#peripherals) for details on individual peripherals.

## Statistics

The VM tracks execution statistics:
- `cycles` - Total instructions executed
- `steps` - Number of step batches (at peripheral frequency)
- `interruptsHandled` - Interrupts successfully dispatched
- `interruptsIgnored` - Interrupts blocked (disabled or unmapped)

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| size | 0x100000 (1MB) | Physical memory size |
| peripheralFrequency | 1000 | Instructions between async yields |
| cycles | unlimited | Maximum cycles before termination |

## Debugging

The VM supports:
- **Breakpoints** - Execute/read/write breakpoints on virtual addresses
- **Watchpoints** - Callbacks on physical address range access
- **Debugger factory** - Pluggable interactive debugger support
