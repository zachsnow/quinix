import { logger } from "@/lib/logger";
import { Address, Immediate, Memory } from "@/lib/types";
import { release, ResolvablePromise } from "@/lib/util";
import { Compiler } from "@/lowlevel/compiler";
import { Instruction, Operation, Program, Register } from "./instructions";
import type { MMU } from "./mmu";
import {
  AccessFlags, ListPageTablePeripheral
} from "./mmu";
import type { PeripheralMapping } from "./peripherals";
import { Peripheral } from "./peripherals";

const log = logger("vm");

type Registers = number[];

/**
 * Records statistics about a running VM.
 */
class Stats {
  public cycles = 0;
  public steps = 0;
  public interruptsHandled = 0;
  public interruptsIgnored = 0;
  public waited = false;

  public start?: Date;
  public stop?: Date;

  public reset() {
    this.cycles = 0;
    this.steps = 0;
    this.start = undefined;
    this.stop = undefined;
  }

  public get seconds() {
    return (+(this.stop ?? 0) - +(this.start ?? 0)) / 1000;
  }

  public toString(): string {
    return [
      ["cycles", this.cycles],
      ["cycles per second", this.cycles / this.seconds],
      ["steps", this.steps],
      ["interrupts handled", this.interruptsHandled],
      ["interrupts ignored", this.interruptsIgnored],
      ["waited?", this.waited],
    ]
      .map(([stat, v]) => {
        return `${stat}: ${v}`;
      })
      .join("\n");
  }
}

class State {
  public registers: Registers;

  public killed: boolean = false;
  public waiting: boolean = false;
  public faulting: boolean = false;

  constructor() {
    this.registers = new Array<number>(Register.REGISTER_COUNT).fill(
      0x00000000
    );
  }

  public reset() {
    this.registers.fill(0x00000000);
    this.killed = false;
    this.waiting = false;
    this.faulting = false;
  }

  public toString(count: number = 8) {
    const display = (r: Register, value: number) => {
      return `${Register.toString(r)}: ${Immediate.toString(value, 2)}`;
    };
    const genericRegisters = this.registers
      .map((value, r) => {
        if (r < count || Compiler.ReservedRegisters.indexOf(r) !== -1) {
          return display(r, value);
        }
      })
      .filter((r) => !!r)
      .join(" ");
    const ip = display(Register.IP, this.registers[Register.IP]);

    return ["[", genericRegisters, ip, "]"].join(" ");
  }
}

type BreakpointType = "execute" | "read" | "write";
type Breakpoint = {
  address: Address;
  type: BreakpointType;
};

/**
 * Interface for an interactive debugger.
 */
interface IDebugger {
  start(): Promise<VMResult | undefined>;
}

/**
 * Factory function to create a debugger instance.
 */
type DebuggerFactory = (vm: VM, state: State, memory: Memory) => IDebugger;

type VMOptions = {
  size?: number;
  peripheralFrequency?: number;
  peripherals?: Peripheral[];
  debug?: boolean;
  mmu?: MMU;
  breakpoints?: Breakpoint[];
  cycles?: number;
  debuggerFactory?: DebuggerFactory;
};

type Interrupt = number;
namespace Interrupt {
  export const RETURN = 0x0;
  export const FAULT = 0x1;
}

type PeripheralAddressMap = { [address: number]: PeripheralMapping };

type VMResult = number;
type VMStepResult = "halt" | "wait" | "continue" | "break";

class VM {
  public readonly stats: Stats = new Stats();

  /**
   *
   */
  private resumeInterrupt?: ResolvablePromise<void>;

  // Interrupt table layout @ 0x0000:
  //  byte: enabled
  //  byte: handler entries address
  //  byte: r0 -- stored register
  //  ...
  //  byte: rn -- stored register
  //  byte: handler entry count
  //  byte: handler entry 0 address
  //  ...
  //  byte: handler entry n address
  private readonly INTERRUPT_TABLE_ENABLED_ADDR: Address = 0x0000;
  private readonly INTERRUPT_TABLE_ENTRIES_ADDR_ADDR: Address = 0x0001;
  private readonly INTERRUPT_TABLE_REGISTERS_ADDR: Address = 0x0002;
  private readonly INTERRUPT_TABLE_COUNT_ADDR: Address =
    Register.REGISTER_COUNT + 0x2;
  private readonly INTERRUPT_TABLE_ENTRIES_ADDR: Address =
    this.INTERRUPT_TABLE_COUNT_ADDR + 0x1;

  // Interrupt handler code @ 0x0100:
  //  byte: handler 1 code
  //  ...
  //  byte: handler 2 code
  //  ...
  private readonly INTERRUPT_HANDLERS_ADDR: Address = 0x0100;

  // Peripheral table layout @ 0x0200:
  //  byte: entry count
  //  byte: entry 1 identifier
  //  byte: entry 1 address
  //  ...
  //  byte: entry n identifier
  //  byte: entry n address
  private readonly PERIPHERAL_TABLE_COUNT_ADDR: Address = 0x0200;
  private readonly PERIPHERAL_TABLE_ENTRIES_ADDR: Address = 0x201;

  // Peripheral mappings.
  private readonly PERIPHERAL_MEMORY_BASE_ADDR: Address = 0x0300;

  public static readonly PROGRAM_ADDR = 0x1000;

  private readonly DEFAULT_PERIPHERAL_FREQUENCY = 1000;
  private peripheralFrequency: number;
  private peripherals: Peripheral[] = [];
  private mappedPeripherals: PeripheralMapping[] = [];
  private peripheralAddresses: PeripheralAddressMap = {};

  // Memory.
  public static readonly DEFAULT_MEMORY_SIZE = 0x00010000;
  private readonly memorySize: number;
  private readonly memory: Memory;

  // MMU.
  private mmu: MMU;

  // Register state.
  private readonly state: State;

  private maxCycles?: number;

  // Breakpoint addresses.
  private breakpointAddresses: { [address: number]: Breakpoint } = {};
  private debugger?: IDebugger;
  private debuggerFactory?: DebuggerFactory;

  public constructor(options?: VMOptions) {
    options = options || {};

    // Configure memory.
    this.memorySize = options.size ?? VM.DEFAULT_MEMORY_SIZE;
    this.state = new State();
    this.memory = new Memory(this.memorySize);

    // Default MMU.
    const mmu = new ListPageTablePeripheral(this.memory);
    this.mmu = mmu;

    // Peripherals. If none are provided, just include the MMU.
    this.peripherals = options.peripherals ?? [mmu];

    // Peripheral frequency.
    this.peripheralFrequency =
      options.peripheralFrequency ?? this.DEFAULT_PERIPHERAL_FREQUENCY;

    // Debugger factory for breakpoint support.
    this.debuggerFactory = options.debuggerFactory;

    // Breakpoints (just records whether to break on a particular *virtual* address, for now).
    (options.breakpoints || []).forEach((breakpoint) => {
      this.breakpointAddresses[breakpoint.address] = breakpoint;
    });

    this.maxCycles = options.cycles;
  }

  private critical(message: string): never {
    throw new Error(`vm: critical fault: ${message}`);
  }

  public fault(message: string): void {
    log.debug(`fault: ${message}`);

    if (this.state.faulting) {
      throw new Error(`fault: double fault: ${message}`);
    }

    this.state.faulting = true;
    if (!this.prepareInterrupt(Interrupt.FAULT)) {
      throw new Error(`fault: unhandled fault: ${message}`);
    }
  }

  private reset() {
    this.stats.reset();
    this.state.reset();
    this.memory.fill(Operation.HALT);
  }

  private loadPeripherals() {
    this.mappedPeripherals = [];
    this.peripheralAddresses = {};

    let baseAddress = this.PERIPHERAL_MEMORY_BASE_ADDR;

    const peripheralsByIdentifier: { [identifier: number]: Peripheral } = {};

    this.peripherals.forEach((peripheral, i) => {
      // Validate no overlapping peripherals.
      const existingPeripheral = peripheralsByIdentifier[peripheral.identifier];
      if (existingPeripheral !== undefined) {
        throw new Error(
          `peripheral identifier ${peripheral.identifier} (${peripheral.name}) already mapped to ${existingPeripheral.name}`
        );
      }

      // Update peripheral table.
      const tableAddress = this.PERIPHERAL_TABLE_ENTRIES_ADDR + 2 * i;
      this.memory[tableAddress] = peripheral.identifier;
      this.memory[tableAddress + 1] = baseAddress;

      // Update the mapping table.
      const peripheralSize = peripheral.io + peripheral.shared;
      const mapping = {
        peripheral,
        base: baseAddress,
        view: this.memory.createView(baseAddress, peripheralSize),
      };

      // Map each io address to the peripheral.
      this.mappedPeripherals.push(mapping);
      for (let i = 0; i < peripheral.io; i++) {
        this.peripheralAddresses[baseAddress + i] = mapping;
      }

      peripheral.map(this, mapping);

      baseAddress += peripheralSize;
    });

    this.memory[this.PERIPHERAL_TABLE_COUNT_ADDR] = this.peripherals.length;

    this.showPeripherals();
  }

  private unloadPeripherals() {
    this.peripherals.forEach((peripheral) => {
      peripheral.unmap();
    });
  }

  private showPeripherals() {
    log.debug(`peripheral table:`);

    const countAddress = this.PERIPHERAL_TABLE_COUNT_ADDR;
    log.debug(
      `${Immediate.toString(countAddress)}: ${Immediate.toString(
        this.memory[countAddress]
      )}`
    );

    this.peripherals.forEach((peripheral, i) => {
      const tableAddress = this.PERIPHERAL_TABLE_ENTRIES_ADDR + 2 * i;
      log.debug(
        `${Immediate.toString(tableAddress)}: ${Immediate.toString(
          this.memory[tableAddress]
        )} (${peripheral.name})`
      );
      log.debug(
        `${Immediate.toString(tableAddress + 1)}: ${Immediate.toString(
          this.memory[tableAddress + 1]
        )}`
      );
    });
  }

  private loadInterrupts() {
    let maxInterrupt = 0;

    let handlerAddress = this.INTERRUPT_HANDLERS_ADDR;
    const mappedInterrupts: { [interrupt: number]: Peripheral } = {};

    // Mark the start of the interrupt handler entries table at a known location so it's
    // easy to reference.
    this.memory[this.INTERRUPT_TABLE_ENTRIES_ADDR_ADDR] =
      this.INTERRUPT_TABLE_ENTRIES_ADDR;

    // Auto-map peripherals.
    this.mappedPeripherals.forEach((mapping) => {
      // Not all peripherals map an interrupt.
      const peripheral = mapping.peripheral;
      const interrupt = peripheral.interrupt;
      if (interrupt === Interrupt.RETURN) {
        return;
      }

      // Check for multiply-mapped interrupts.
      const existingPeripheral = mappedInterrupts[interrupt];
      if (existingPeripheral !== undefined) {
        throw new Error(
          `peripheral interrupt ${interrupt} (${peripheral.name}) already mapped to ${existingPeripheral.name}`
        );
      }

      // Some peripherals map an interrupt, but do not provide a handler.
      const instructions = peripheral.interruptHandler;
      if (instructions.length) {
        // Write instructions at handler address.
        const baseHandlerAddress = handlerAddress;
        instructions.forEach((i) => {
          this.memory[handlerAddress] = i.encode();
          handlerAddress += 1;
        });

        // Map handler address.
        this.memory[this.INTERRUPT_TABLE_ENTRIES_ADDR + interrupt] =
          baseHandlerAddress;
      }

      maxInterrupt = Math.max(maxInterrupt, interrupt);
    });

    // Write handlers.
    this.memory[this.INTERRUPT_TABLE_COUNT_ADDR] = maxInterrupt;

    // Enable interrupts.
    this.memory[this.INTERRUPT_TABLE_ENABLED_ADDR] = 0x1;

    this.showInterrupts(
      this.memory.createView(
        this.INTERRUPT_HANDLERS_ADDR,
        handlerAddress - this.INTERRUPT_HANDLERS_ADDR
      )
    );
  }

  private showInterrupts(handlerCode: Memory) {
    log.debug(`interrupt table:`);

    const enabledAddr = this.INTERRUPT_TABLE_ENABLED_ADDR;
    const enabled = this.memory[enabledAddr];
    log.debug(
      `${Immediate.toString(enabledAddr)}: ${Immediate.toString(enabled)}`
    );

    const countAddress = this.INTERRUPT_TABLE_COUNT_ADDR;
    var handlerCount = this.memory[countAddress];

    log.debug(
      `${Immediate.toString(countAddress)}: ${Immediate.toString(handlerCount)}`
    );
    for (let i = 0; i <= handlerCount; i++) {
      log.debug(
        `${Immediate.toString(
          this.INTERRUPT_TABLE_ENTRIES_ADDR + i
        )}: ${Immediate.toString(
          this.memory[this.INTERRUPT_TABLE_ENTRIES_ADDR + i]
        )}`
      );
    }

    const program = Program.decode(handlerCode);
    log.debug(
      `interrupt code:\n${program.toString(this.INTERRUPT_HANDLERS_ADDR)}\n`
    );
  }

  private loadProgram(program: Uint32Array) {
    this.memory.set(program, VM.PROGRAM_ADDR);
    this.state.registers[Register.IP] = VM.PROGRAM_ADDR;
  }

  public dump(address: Address, length: number) {
    return this.memory.createView(address, length);
  }

  /**
   * Kill the machine.
   */
  public kill(): void {
    this.state.killed = true;
  }

  /**
   * Runs the given program and returns a promise that resolves
   * to the execution result (that is, `r0` when `halt` is executed).
   *
   * @param program the program to run.
   */
  public async run(program: Uint32Array): Promise<VMResult> {
    // Reset registers and memory, statistics, etc.
    this.reset();

    // Load and map peripherals.
    this.loadPeripherals();

    // Load interrupts.
    this.loadInterrupts();

    // Load program.
    this.loadProgram(program);

    // Step the machine until we halt.
    try {
      // NOTE: we *must* block here with `await` or our finally
      // will run before we've waited for execution to complete.
      this.stats.start = new Date();
      const r = await this.execute();
      this.stats.stop = new Date();
      return r;
    } finally {
      // Unmap.
      this.unloadPeripherals();
    }
  }

  /**
   * Triggers an interrupt on the machine. Returns a promise
   * that will resolve when the machine returns from the interrupt.
   *
   * @param interrupt the interrupt to trigger.
   */
  public interrupt(interrupt: Interrupt): boolean {
    if (interrupt === Interrupt.RETURN) {
      this.critical(`invalid interrupt: ${Immediate.toString(interrupt, 1)}`);
    }

    if (this.prepareInterrupt(interrupt)) {
      // Currently in "wait" mode; this will allow `execute`
      // to resume from the wait.
      if (this.resumeInterrupt) {
        this.resumeInterrupt.resolve();
        this.resumeInterrupt = undefined;
        log.debug(
          `resuming due to interrupt ${Immediate.toString(interrupt, 1)}...`
        );
      } else {
        log.debug(`not waiting`);
      }

      // In any event, since we've already prepared
      // the interrupt, execution will resume once we return.
      return true;
    }
    return false;
  }

  /**
   * Returns a promise that will be resolved when we prepare the
   * next interrupt.
   */
  private async nextInterrupt(): Promise<void> {
    if (this.resumeInterrupt) {
      this.critical(`waiting before previous wait has completed`);
    }

    this.state.waiting = true;

    this.resumeInterrupt = new ResolvablePromise<void>();
    return this.resumeInterrupt.promise;
  }

  /**
   * Resumes execution.
   */
  private async execute(): Promise<VMResult> {
    while (true) {
      // Pause each step at the peripheral frequency to allow them to run.
      let result = this.step(this.peripheralFrequency);
      this.stats.steps++;

      switch (result) {
        case "continue":
          // Keep on keeping on.
          await release();
          break;

        case "break":
          // When the debugger completes, either it is either by `continue` or by `quit`.
          // (To step through the code, it synchronously invokes `step`). If it continues,
          // it resolves to `undefined` and we carry on executing. If it quits,
          // it resolves to a number that we should treat as the machine halting with.
          const debugResult = await this.breakpoint(
            this.state.registers[Register.IP]
          );
          if (debugResult !== undefined) {
            log.debug(`quit: ${Immediate.toString(debugResult)}`);
            return debugResult;
          }
          break;

        case "wait":
          // Wait for the next interrupt to begin trigger.  This will resume
          // execution.
          log.debug("wait");
          this.stats.waited = true;
          this.state.waiting = true;
          await this.nextInterrupt();
          break;

        case "halt":
          const r = this.state.registers[Register.R0];
          log.debug(`halt: ${Immediate.toString(r)}`);
          return r;
      }

      if (this.state.killed) {
        log.debug(`killed`);
        return -1;
      }
    }
  }

  private interruptStore(): void {
    // Store each register in the register location.
    const base = this.INTERRUPT_TABLE_REGISTERS_ADDR;
    for (var i = 0; i < this.state.registers.length; i++) {
      this.memory[base + i] = this.state.registers[i];
    }
  }

  private interruptRestore(): void {
    // Read each register in the register location.
    const base = this.INTERRUPT_TABLE_REGISTERS_ADDR;
    for (var i = 0; i < this.state.registers.length; i++) {
      this.state.registers[i] = this.memory[base + i];
      this.memory[base + i] = 0;
    }
  }

  /**
   * Prepares the machine to handle the given interrupt. Returns `true` if
   * the interrupt is mapped, and the machine's state is updated. Otherwise,
   * returns `false`, and the machine's state remains unchanged.
   *
   * @param interrupt the interrupt to prepare to handle.
   */
  private prepareInterrupt(interrupt: Interrupt): boolean {
    // Special cases.
    if (interrupt === Interrupt.RETURN) {
      log.debug(`interrupt 0x0: return`);

      // Restore registers, including `ip`.
      this.interruptRestore();

      // A successful return clears the faulting flag because either
      // we are returning from the fault handler, or we weren't faulting
      // in the first place.
      this.state.faulting = false;

      // If we restored an `ip` of 0 we performed an invalid return,
      // bail out.
      if (!this.state.registers[Register.IP]) {
        this.fault(`invalid interrupt return`);
        return true;
      }

      // Re-enable interrupts.
      this.memory[this.INTERRUPT_TABLE_ENABLED_ADDR] = 0x1;

      // Re-enable MMU.
      this.mmu.enable();

      // We set the fault flag upon fault so that

      return true;
    }

    // Fault is not masked by disabling interrupts.
    const isMasked = !this.memory[this.INTERRUPT_TABLE_ENABLED_ADDR];
    if (!this.state.faulting && isMasked) {
      this.stats.interruptsIgnored++;
      log.debug(
        `interrupt ${Immediate.toString(interrupt)}: interrupts disabled`
      );
      return false;
    }

    // Find the handler.
    const handlerCount = this.memory[this.INTERRUPT_TABLE_COUNT_ADDR];
    if (interrupt > handlerCount) {
      this.fault(
        `invalid interrupt ${Immediate.toString(
          interrupt
        )} (${handlerCount} mapped)`
      );
      return true;
    }

    // Load handler address; a 0x0 indicates that the interrupt handler
    // is not currently mapped and should be ignored.
    const handler = this.memory[this.INTERRUPT_TABLE_ENTRIES_ADDR + interrupt];
    if (handler === 0x0) {
      log.debug(
        `interrupt ${Immediate.toString(
          interrupt
        )}: handler not mapped at address ${Immediate.toString(
          this.INTERRUPT_TABLE_ENTRIES_ADDR + interrupt
        )}`
      );
      return false;
    }

    // Disable MMU.
    this.mmu.disable();

    // Disable interrupts.
    this.memory[this.INTERRUPT_TABLE_ENABLED_ADDR] = 0x0;

    // Advance so we save the *next* instruction, not the current instruction.
    this.state.registers[Register.IP]++;

    // Store state. If an interrupt handler is interrupted by fault, we *replace* it with
    // the fault handler, but we do not store the state. When the fault
    // handler returns, it returns as though from the replaced handler.
    //
    // This means that faults that occur in an interrupt handler "cancel" the rest of
    // the interrupt handler.
    //
    // The only time we skip storing the interrupt state is when we were masked,
    // as that means we are in the process of handling a double fault and we want
    // the next interrupt return to return to the location when the *original* interrupt
    // was triggered.
    if (!isMasked) {
      this.interruptStore();
    }

    // Jump to register.
    this.state.registers[Register.IP] = handler;

    this.stats.interruptsHandled++;

    return true;
  }

  private async breakpoint(
    virtualAddress: Address
  ): Promise<VMResult | undefined> {
    // Already stepping through the code.
    if (this.debugger) {
      return;
    }

    // No debugger factory provided - skip breakpoints.
    if (!this.debuggerFactory) {
      log.debug(
        `breakpoint ${Immediate.toString(virtualAddress)} (no debugger)`
      );
      return;
    }

    log.debug(`breakpoint ${Immediate.toString(virtualAddress)}`);
    try {
      log.debug("starting debugger...");
      this.debugger = this.debuggerFactory(this, this.state, this.memory);
      return await this.debugger.start();
    } finally {
      this.debugger = undefined;
    }
  }

  /**
   * Run the machine synchronously.
   *
   * @param cycles maximum number of cycles to execute.
   */
  public step(cycles?: number): VMStepResult {
    const state = this.state;
    const registers = this.state.registers;
    const memory = this.memory;
    const mmu = this.mmu;
    const peripheralAddresses = this.peripheralAddresses;

    const maxCycles = this.maxCycles;
    let stepCycles = 0;

    while (true) {
      // Fetch the instruction.
      let virtualIp = registers[Register.IP];

      // Check breakpoints. If we found one, run the debugger.
      // Breakpoints are set against virtual memory for now.
      if (
        this.breakpointAddresses[virtualIp]?.type === "execute" &&
        !this.debugger
      ) {
        // If the debugger returns a "real" result, we're done,
        // otherwise we can carry on executing.
        return "break";
      }

      // Translate the virtual address to a physical address.
      let physicalIp = mmu.translate(virtualIp, AccessFlags.Execute);
      if (physicalIp === undefined) {
        this.fault(
          `memory fault: ${Address.toString(
            virtualIp
          )} not executable fetching instruction`
        );
        return "continue";
      }

      // The physical address must fit within the constraints of "physical" memory.
      if (physicalIp < 0 || physicalIp >= this.memorySize) {
        this.fault(
          `memory fault: ${Address.toString(
            physicalIp
          )} out of bounds fetching instruction`
        );
        return "continue";
      }

      // Fetch and decode the instruction.
      const encoded = memory[physicalIp];
      const decoded = Instruction.decode(encoded);

      // Invalid instruction.
      if (decoded.immediate !== undefined) {
        this.fault(
          `${Address.toString(virtualIp)}: invalid instruction: ${decoded}`
        );
        return "continue";
      }

      log.debug(`${state}: ${Immediate.toString(encoded)}: ${decoded}`);

      // By default we advance by 1; constants, jumps, and interrupts change this.
      let ipOffset = 1;

      switch (decoded.operation) {
        case Operation.HALT:
          return "halt";

        case Operation.WAIT:
          return "wait";

        case Operation.INT: {
          const interrupt = registers[decoded.sr0!];
          const prepared = this.prepareInterrupt(interrupt);
          if (prepared) {
            // Interrupt prepared. If we are waiting and we just performed an interrupt
            // return (int 0x0), we should carry on waiting. Otherwise we want to execute the
            // body of the interrupt, so we `continue` (to release for peripherals and then
            // resume execution).
            return !interrupt && this.state.waiting ? "wait" : "continue";
          }
        }

        case Operation.LOAD: {
          const virtualAddress = registers[decoded.sr0!];

          // Check for breakpoints.
          if (
            this.breakpointAddresses[virtualAddress]?.type === "read" &&
            !this.debugger
          ) {
            return "break";
          }

          const physicalAddress = mmu.translate(
            virtualAddress,
            AccessFlags.Read
          );
          if (physicalAddress === undefined) {
            this.fault(
              `memory fault: ${Address.toString(
                virtualAddress
              )} invalid mapping reading -- ${decoded}`
            );
            return "continue";
          }

          if (physicalAddress >= this.memorySize) {
            this.fault(
              `memory fault: ${Address.toString(
                physicalAddress
              )} out of bounds reading -- ${decoded}`
            );
            return "continue";
          }

          const value = memory[physicalAddress];
          registers[decoded.dr!] = value;
          break;
        }
        case Operation.STORE: {
          const virtualAddress = registers[decoded.dr!];

          // Check for breakpoints.
          if (
            this.breakpointAddresses[virtualAddress]?.type === "write" &&
            !this.debugger
          ) {
            return "break";
          }

          const physicalAddress = mmu.translate(
            virtualAddress,
            AccessFlags.Write
          );
          if (physicalAddress === undefined) {
            this.fault(
              `memory fault: ${Address.toString(
                virtualAddress
              )} invalid mapping writing -- ${decoded}`
            );
            return "continue";
          }

          if (physicalAddress >= this.memorySize) {
            this.fault(
              `memory fault: ${Address.toString(
                physicalAddress
              )} out of bounds writing -- ${decoded}`
            );
            return "continue";
          }

          const value = registers[decoded.sr0!];
          memory[physicalAddress] = value;

          // Check peripheral mapping for a method.
          const peripheralMapping = peripheralAddresses[physicalAddress];
          if (peripheralMapping) {
            log.debug(
              `notifying peripheral ${peripheralMapping.peripheral.name}...`
            );
            peripheralMapping.peripheral.notify(
              physicalAddress - peripheralMapping.base
            );
          }
          break;
        }
        case Operation.MOV:
          registers[decoded.dr!] = registers[decoded.sr0!];
          break;
        case Operation.CONSTANT: {
          const virtualAddress = virtualIp + 1;
          const physicalAddress = mmu.translate(
            virtualAddress,
            AccessFlags.Read
          );
          if (physicalAddress === undefined) {
            this.fault(
              `memory fault: ${Address.toString(
                virtualAddress
              )} invalid mapping`
            );
            return "continue";
          }

          if (physicalAddress >= this.memorySize) {
            this.fault(
              `memory fault: ${Address.toString(physicalAddress)} out of bounds`
            );
            return "continue";
          }

          const value = memory[physicalAddress];
          registers[decoded.dr!] = value;
          log.debug(
            `${state.toString()}: ${Immediate.toString(
              value
            )}: ${Immediate.toString(value)}`
          );

          ipOffset = 2;
          break;
        }

        case Operation.ADD:
          registers[decoded.dr!] =
            (registers[decoded.sr0!] + registers[decoded.sr1!]) >>> 0;
          break;
        case Operation.SUB:
          registers[decoded.dr!] =
            (registers[decoded.sr0!] - registers[decoded.sr1!]) >>> 0;
          break;
        case Operation.MUL:
          registers[decoded.dr!] =
            Math.imul(registers[decoded.sr0!], registers[decoded.sr1!]) >>> 0;
          break;
        case Operation.DIV:
          registers[decoded.dr!] =
            (registers[decoded.sr0!] / registers[decoded.sr1!]) >>> 0;
          break;
        case Operation.MOD:
          registers[decoded.dr!] =
            registers[decoded.sr0!] % registers[decoded.sr1!] >>> 0;
          break;

        case Operation.AND:
          registers[decoded.dr!] =
            (registers[decoded.sr0!] & registers[decoded.sr1!]) >>> 0;
          break;
        case Operation.OR:
          registers[decoded.dr!] =
            (registers[decoded.sr0!] | registers[decoded.sr1!]) >>> 0;
          break;
        case Operation.NOT:
          registers[decoded.dr!] = ~registers[decoded.sr0!] >>> 0;
          break;

        case Operation.EQ:
          registers[decoded.dr!] =
            registers[decoded.sr0!] === registers[decoded.sr1!] ? 0 : 1;
          break;
        case Operation.NEQ:
          registers[decoded.dr!] =
            registers[decoded.sr0!] !== registers[decoded.sr1!] ? 0 : 1;
          break;
        case Operation.LT:
          registers[decoded.dr!] =
            (registers[decoded.sr0!] & 0xffffffff) <
              (registers[decoded.sr1!] & 0xffffffff)
              ? 0
              : 1;
          break;
        case Operation.GT:
          registers[decoded.dr!] =
            (registers[decoded.sr0!] & 0xffffffff) >
              (registers[decoded.sr1!] & 0xffffffff)
              ? 0
              : 1;
          break;

        case Operation.JMP:
          registers[Register.IP] = registers[decoded.sr0!];
          ipOffset = 0;
          break;
        case Operation.JZ:
          if (registers[decoded.sr0!] === 0) {
            registers[Register.IP] = registers[decoded.sr1!];
            ipOffset = 0;
          }
          break;
        case Operation.JNZ:
          if (registers[decoded.sr0!] !== 0) {
            registers[Register.IP] = registers[decoded.sr1!];
            ipOffset = 0;
          }
          break;

        case Operation.NOP:
          break;

        default:
          this.fault(`unimplemented instruction: ${decoded.operation}`);
          return "continue";
      }

      // Advance.
      registers[Register.IP] += ipOffset;

      // Check if we have stepped the requested number of times;
      // there's a machine limit and a per-step limit; don't bother
      // if we are already stopped.
      this.stats.cycles++;
      stepCycles++;

      // Machine total limit.
      if (maxCycles !== undefined && this.stats.cycles >= maxCycles) {
        this.critical(`exceeded max cycles ${this.maxCycles}`);
      }

      // Per-step limit; release so that peripherals can run.
      if (cycles !== undefined && stepCycles >= cycles) {
        return "continue";
      }
    }
  }
}

export { State, VM };
export type {
  Breakpoint, DebuggerFactory, IDebugger, Interrupt, VMResult,
  VMStepResult
};

