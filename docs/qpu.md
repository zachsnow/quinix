# Quinix CPU

The Quinix CPU (QPU) is a 32-bit RISC processor.

## Registers

The QPU has 1 special-purpose register, `ip` (the instruction pointer),
along with 64 general-purpose registers, `r0`...`r63`.

## Instructions

In the following, `d` is a generic register that can be thought
of as the *destination* of the operation, while each `s` is a generic
register or special-purpose register that can be thought of as the *source*
or *sources* of the operation.

`halt`: halt execution

`int s`: trigger interrupt `s`

`wait`: halt until next interrupt

**Memory access and register manipulation**

`load d s`: load value at address `s` into `d`

`store d s`: store `s` into address `d`

`mov d s`: move value of `s` to `d`

`constant d`: load value at address `ip + 1` into `d`

> The expectation is that the next word in the binary is an "immediate"
> value.

**Arithmetic**

`add d s0 s1`: store `s0` plus `s1` into `d`

`sub d s0 s1`: store `s0` minus `s1` into `d`

`mul d s0 s1`: store `s0` times `s1` into `d`

`div d s0 s1`: store `s0` integer-divided by `s1` into `d`

`rem d s0 s1`: store the remainder of `s0` integer-divided by `s1` into `d`

> All integer arithmetic expressions are 32-bit, including multiplication.

**Floating point arithmetic**

Floating point values are IEEE 754 single-precision floats stored in 32-bit words. They use the same general-purpose registers as integers.

`fadd d s0 s1`: store `s0` plus `s1` (as floats) into `d`

`fsub d s0 s1`: store `s0` minus `s1` (as floats) into `d`

`fmul d s0 s1`: store `s0` times `s1` (as floats) into `d`

`fdiv d s0 s1`: store `s0` divided by `s1` (as floats) into `d`

**Floating point comparison**

`feq d s0 s1`: if `s0` equals `s1` (as floats), store `0x1` into `d`; otherwise, store `0x0`

`flt d s0 s1`: if `s0` is less than `s1` (as floats), store `0x1` into `d`; otherwise, store `0x0`

`fgt d s0 s1`: if `s0` is greater than `s1` (as floats), store `0x1` into `d`; otherwise, store `0x0`

**Float/integer conversion**

`itof d s`: convert signed integer `s` to float, store in `d`

`utof d s`: convert unsigned integer `s` to float, store in `d`

`ftoi d s`: convert float `s` to signed integer (truncating toward zero), store in `d`

**Bitwise operators**

`and d s0 s1`: store `s0` bitwise-and `s1` into `d`

`or d s0 s1`:  store `s0` bitwise-or `s1` into `d`

`not d s`:  store `s` bitwise-negated into `d`

`shl d s0 s1`: store `s0` left-shifted by `s1` bits into `d`

`shr d s0 s1`: store `s0` right-shifted (logical) by `s1` bits into `d`

**Comparison operators**

`eq d s0 s1`: if `s0` is equal to `s1`, store `0x1` into `d`; otherwise, store `0x0`

`neq d s0 s1`: if `s0` is not equal to `s1`, store `0x1` into `d`; otherwise, store `0x0`

`lt d s s`: if `s0` is less than `s1`, store `0x1` into `d`; otherwise, store `0x0`

`gt d s s`: if `s0` is greater than `s1`, store `0x1` into `d`; otherwise, store `0x0`

**Branching operators**

`jmp s`: jump to the address `s`

`jz s0 s1`: if `s0` is `0x0`, jump to the address `s1`

`jnz s0 s1`: if `s0` is not `0x0`, jump to the address `s1`

> the implicit destination of the "jump" instructions is `ip`.

`nop`: no-op

## Instruction Encoding

Instructions are always encoded as 32-bit words. The first 8 bits (or *octet*) represent
the instruction itself (e.g. `add`, `sub`, and so on). The values of each instruction
can be found [here](../src/vm/instructions.ts#L6).

The second octet encodes the destination register, if the operation uses one --
otherwise, they should equal `0x00`, and will be ignored.

Likewise, the third and fourth octets encode the source register or registers, if needed --
again, if the operation does not require them, they should equal `0x00`, and will be ignored.

```
Bits:  31-24    23-16    15-8     7-0
       opcode   dest     src0     src1
```

### Example: simple program

The following program copies the memory located at the address stored in `r0` (the
"source buffer" to the address stored in `r1` (the "destination buffer"). It assumes
that the source buffer is zero-terminated.

(In the following, the left column is meant to be the *binary* contents of the file,
and the rest is just line-by-line commentary).

```
    0x02020000      ; load r2 r0        -- read a byte from source.
    0x03010200      ; store r1 r2       -- write a byte to destination.

    0x05030000      ; constant r3       -- 1 for incrementing.
    0x00000001      ; 0x1               -- immediate value.
    0x06000003      ; add r0 r0 r3      -- increment the source pointer.
    0x06010103      ; add r1 r1 r3      -- increment the destination pointer.

    0x05040000      ; constant r4       -- the address of the beginning of the loop.
    0x00000000      ; 0x0               -- immediate value.
    0x10020400      ; jnz r2 r4         -- if we haven't found the 0x0 terminator, keep copying.

    0x00000000      ; halt              -- otherwise, we're done.
```

## Interrupts

Interrupts transfer control to a handler. See [QVM Interrupt Handling](./qvm.md#interrupt-handling) for the full interrupt mechanism.

Software interrupts are triggered with `int s` where `s` contains the interrupt number. Hardware interrupts are triggered by peripherals asynchronously.

## Peripherals

All peripheral interaction is via DMA (Direct Memory Access). Peripherals map a contiguous
region of physical memory:

- **IO region** - Writes to these bytes trigger `notify()` on the peripheral
- **Shared region** - Regular memory for data exchange (no notification)

### Peripheral Discovery

Programs discover peripherals via the peripheral table at 0x0200:

```
0x0200: count          ; Number of peripherals
0x0201: identifier_0   ; First peripheral's identifier
0x0202: address_0      ; First peripheral's base address
0x0203: identifier_1   ; Second peripheral's identifier
0x0204: address_1      ; Second peripheral's base address
...
```

### Buffered Peripherals

Many peripherals use a common "buffered" protocol for streaming data. The memory layout:

| Offset | Name | Description |
|--------|------|-------------|
| 0x00 | control | Command/status byte (IO - triggers notify) |
| 0x01 | capacity | Buffer capacity (read-only) |
| 0x02 | size | Data size for current operation |
| 0x03+ | buffer | Data buffer |

**Control values:**

| Value | Name | Description |
|-------|------|-------------|
| 0x00 | READY | Peripheral idle, operation complete |
| 0x01 | WRITE | Request write (client sets size, fills buffer) |
| 0x02 | READ | Request read (peripheral fills buffer, sets size) |
| 0x03 | PENDING | Operation in progress |
| 0xFF..FF | ERROR | Operation failed |

**Write protocol:**
1. Client writes data to buffer
2. Client sets size to data length
3. Client sets control to WRITE (0x01)
4. Peripheral sets control to PENDING (0x03)
5. Peripheral processes data
6. Peripheral sets control to READY (0x00) or ERROR

**Read protocol:**
1. Client sets control to READ (0x02)
2. Peripheral sets control to PENDING (0x03)
3. Peripheral fills buffer, sets size
4. Peripheral sets control to READY (0x00) or ERROR
5. Client reads size bytes from buffer

**Large transfers:** For data larger than the buffer, the client can perform multiple operations. On write, if size > capacity, the peripheral accumulates data until size <= capacity. On read, if the peripheral has more data than capacity, subsequent READ operations return the next chunk.

---

## Peripheral Reference

### Timer (0x00000001)

Hardware timer that triggers periodic interrupts.

| Offset | Name | IO | Description |
|--------|------|-----|-------------|
| 0x00 | interval | Yes | Timer interval in milliseconds |

**Interrupt:** 0x02

**Operation:**
- Write milliseconds to interval to start the timer
- Write 0 to disable the timer
- Timer triggers interrupt 0x02 at the configured interval

**Example:**
```qasm
; Start 100ms timer
constant r0 @timer_addr
constant r1 100
store r0 r1
```

---

### Debug Break (0x00000002)

Triggers the host debugger (JavaScript `debugger` statement).

| Offset | Name | IO | Description |
|--------|------|-----|-------------|
| 0x00 | control | Yes | Break control |

**Interrupt:** 0x03

**Control values:**
- 0x00 COMPLETE - Break finished
- 0x01 BREAK - Request break
- 0x02 PENDING - Break in progress
- 0x03 ERROR - Invalid operation

Programs can use `int 0x3` to trigger a break; the interrupt handler writes BREAK to control.

---

### Debug Output (0x00000003)

Writes text to stdout. Uses the buffered peripheral protocol.

**Type:** Buffered (write-only)

**Operation:** Write Unicode code points to the buffer, trigger WRITE. Output appears on stdout.

**Example:**
```qasm
; Write "Hi" to output
constant r0 @output_addr
constant r1 2           ; size
store r0 + 2 r1         ; set size

constant r1 'H'
store r0 + 3 r1         ; buffer[0]
constant r1 'i'
store r0 + 4 r1         ; buffer[1]

constant r1 1           ; WRITE
store r0 r1             ; trigger
```

---

### Debug Input (0x00000004)

Reads line-buffered text from stdin. Uses the buffered peripheral protocol.

**Type:** Buffered (read-only)

**Operation:** Trigger READ. Blocks until newline received. Returns line without newline.

---

### Keypress (0x00000010)

Receives individual keypress events (raw mode, server only).

| Offset | Name | IO | Description |
|--------|------|-----|-------------|
| 0x00-0x01 | (none) | - | Shared region |

**Shared region:** 2 words for keypress data

**Interrupt:** 0x10

**Operation:** When a key is pressed, the peripheral writes the key code to shared memory and triggers interrupt 0x10.

---

### Debug File (0x00000011)

Reads and writes files from the host filesystem. Uses the buffered peripheral protocol.

**Type:** Buffered (read/write)

**Operation:**
1. WRITE the file path (sets the path for subsequent operations)
2. READ to read file contents, or WRITE to write file contents

Binary files (.qbin, .bin) are read as 32-bit words (little-endian). Text files are read as Unicode code points.

---

### Block Device (0x00000020)

Block storage device for disk I/O. Uses DMA transfers.

| Offset | Name | IO | Description |
|--------|------|-----|-------------|
| 0x00 | command | Yes | Command to execute |
| 0x01 | status | No | Device status |
| 0x02 | lba | No | Logical block address |
| 0x03 | count | No | Sector count (1-255) |
| 0x04 | buffer_ptr | No | DMA buffer address in main memory |
| 0x05 | total_sectors | No | Device capacity (read-only) |
| 0x06 | sector_size | No | Words per sector (read-only, typically 128) |
| 0x07 | error_code | No | Last error code |

**Commands:**

| Value | Name | Description |
|-------|------|-------------|
| 0x00 | NOP | No operation |
| 0x01 | READ | Read sectors from LBA to buffer_ptr |
| 0x02 | WRITE | Write sectors from buffer_ptr to LBA |
| 0x03 | FLUSH | Ensure writes are persisted |

**Status values:**

| Value | Name | Description |
|-------|------|-------------|
| 0x00 | READY | Device idle |
| 0x01 | BUSY | Operation in progress |
| 0xFF | ERROR | Operation failed |

**Error codes:**

| Value | Name | Description |
|-------|------|-------------|
| 0x00 | NONE | No error |
| 0x01 | INVALID_LBA | LBA out of range |
| 0x02 | INVALID_COUNT | Count is 0 or exceeds device |
| 0x03 | IO_ERROR | Storage backend error |

**Example:**
```qasm
; Read sector 0 into memory at 0x5000
constant r0 @block_dev_addr

constant r1 0           ; LBA = 0
store r0 + 2 r1

constant r1 1           ; count = 1
store r0 + 3 r1

constant r1 0x5000      ; buffer
store r0 + 4 r1

constant r1 1           ; READ command
store r0 r1             ; trigger

@wait:
load r1 r0 + 1          ; check status
jnz r1 @wait            ; wait for READY (0)
```

---

### Browser Output (0x00000003)

Browser variant of debug output. Writes to a DOM element.

**Type:** Buffered (write-only)

**Platform:** Browser only

---

### Browser Input (0x00000004)

Browser variant of debug input. Creates an input field with Enter button.

**Type:** Buffered (read-only)

**Platform:** Browser only

---

## MMU Peripherals

The MMU is implemented as a peripheral that receives page table updates.

### List Page Table (0x80000002)

Simple list-based page table. Default MMU implementation.

| Offset | Name | IO | Description |
|--------|------|-----|-------------|
| 0x00 | base_address | Yes | Address of page table in memory |

**Page table format:**
```
base + 0: entry_count
base + 1: entry_0_virtual_address
base + 2: entry_0_physical_address
base + 3: entry_0_size
base + 4: entry_0_flags
base + 5: entry_1_virtual_address
...
```

Each entry maps a contiguous region. Flags are Present/Read/Write/Execute (see [QVM Access Flags](./qvm.md#access-flags)).

**Operation:** Write the page table base address to trigger a rebuild of the internal mapping cache.

---

### Two-Level Page Table (0x80000001)

x86-style hierarchical page table with 4KB pages.

| Offset | Name | IO | Description |
|--------|------|-----|-------------|
| 0x00 | base_address | Yes | Address of first-level table |

**Address translation:**
```
Virtual address: [L1 index: 10 bits][L2 index: 10 bits][offset: 12 bits]

L1 entry: [L2 table address: 28 bits][flags: 4 bits]
L2 entry: [physical page: 20 bits][unused: 8 bits][flags: 4 bits]
```

The MMU caches translations for performance. Writing to base_address invalidates the cache.
