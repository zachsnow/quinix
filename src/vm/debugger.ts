import readline from 'readline';

import { logger } from '../lib/logger';
import { ResolvablePromise } from '../lib/util';
import { Memory, Immediate, Address } from "../lib/base-types";
import { VM, State } from './vm';
import type { VMResult } from './vm';
import { Register, Instruction, Program } from './instructions';
import { Compiler } from '../lowlevel/compiler';

const log = logger('vm:debugger');

type CommandHandlerResult = 'done' | undefined;
type CommandHandler = (...args: string[]) => Promise<CommandHandlerResult>;
type ParsedCommand = {
  command: CommandHandler;
  args: string[],
}


enum Color {
  Black = '\u001b[30m',
  Red = '\u001b[31m',
  Green = '\u001b[32m',
  Yellow = '\u001b[33m',
  Blue = '\u001b[34m',
  Magenta = '\u001b[35m',
  Cyan = '\u001b[36m',
  White = '\u001b[37m',
  Reset = '\u001b[0m',
}

namespace Color {
  export function escape(s: string, c: Color){
    return `${c}${s}${Color.Reset}`;
  }
}

/**
 * An interactive debugger for the virtual machine.
 */
class Debugger {
  private static readonly Done = 'done';

  private interface?: readline.Interface;

  private commandNames: string[] = [];
  private commands: { [ command: string ]: CommandHandler | undefined } = {};

  private vm: VM;
  private state: State;
  private memory: Memory;

  private resolvable: ResolvablePromise<VMResult | undefined>;

  public constructor(vm: VM, state: State, memory: Memory){
    this.vm = vm;
    this.state = state;
    this.memory = memory;

    const commands: [string, CommandHandler][] = [
      ['continue', this.continue],
      ['decode', this.decode],
      ['frame', this.frame],
      ['info', this.info],
      ['help', this.help],
      ['memory', this.mem],
      ['quit', this.quit],
      ['registers', this.registers],
      ['step', this.step],
      ['where', this.where],
    ];

    this.commandNames = commands.map(([name, command]) => name);
    this.commands = {};
    commands.forEach(([name, command]) => {
      this.commands[name] = command;
    });

    this.resolvable = new ResolvablePromise();
    this.resolvable.promise.finally(() => {
      this.stop();
    });

    log.debug('initialized debugger');
  }

  public start(): Promise<VMResult | undefined> {
    this.interface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: this.completer,
      historySize: 1000,
      prompt: this.color('# ', Color.Green),
      tabSize: 2,
    });

    this.interface.on('line', (e) => {
      this.onLine(e);
    });

    this.onLine('i');

    log.debug('started debugger');

    return this.resolvable.promise;
  }

  public stop() {
    if(this.interface){
      this.interface.close();
    }
  }

  private completer(line: string){
    return [this.commandNames, line];
  }

  private helpText(commandName: string){
    const command = this.commands[commandName];
    if(!command){
      return;
    }
    const text = command.toString();
    const match = /\/\/ help: (.*)\n/.exec(text);
    if(match){
      return match[1];
    }
  }

  //
  // Commands.
  //
  private async help(): Promise<CommandHandlerResult> {
    // help: help -- display help.
    let help = this.commandNames.map((c) => this.helpText(c)).filter((h): h is string => !!h);
    help = help.map((h) => {
      const parts = h.split(' -- ');
      return `  ${this.color(parts[0], Color.Green)} ${this.color('--', Color.White)} ${parts[1]}`;
    });
    this.write(`commands:\n${help.join('\n')}`);
    return;
  }

  private async quit(): Promise<CommandHandlerResult> {
    // help: quit -- quit the virtual machine.
    this.resolvable.resolve(-1);
    return Debugger.Done;
  }

  private async frame(count: string = '16'): Promise<CommandHandlerResult> {
    // help: frame [count] -- display current stack frame (ish).
    // TODO: figure out how to show the current frame, not just the recent stack.
    const sp = this.state.registers[Compiler.SP];
    return this.mem(sp.toString(), '8', count, 'true');
  }

  private async info(): Promise<CommandHandlerResult> {
    // help: info -- display overview.
    const encoded = this.memory[this.state.registers[Register.IP]];
    const decoded = Instruction.decode(encoded);

    this.write(`     ${this.color(this.state.toString(), Color.Green)}: ${Immediate.toString(encoded)}: ${this.color(decoded.toString(), Color.Blue)}`);

    return;
  }

  private async registers(registerName: string, value: string): Promise<CommandHandlerResult> {
    // help: registers [register] [value] -- display and change register values.
    if(arguments.length === 0){
      this.write(this.state.toString());
      return;
    }

    let r: Register;
    try {
      r = Register.parse(registerName);
    }
    catch(e){
      this.error(`invalid register ${registerName}`);
      return;
    }

    if(arguments.length === 1){
      this.write(`${Register.toString(r)}: ${Immediate.toString(this.state.registers[r])}`);
      return;
    }

    if(arguments.length === 2){
      const val = Immediate.parse(value || '');
      if(isNaN(val)){
        this.error(`invalid value ${value}`);
      }
      this.state.registers[r] = val;
      this.write(`${Register.toString(r)}: ${Immediate.toString(this.state.registers[r])}`);
      return;
    }

    this.error(`invalid arguments`);
  }

  private async step(n: string = '1'): Promise<CommandHandlerResult> {
    // help: step [n] -- step the virtual machine.
    const cycles = parseInt(n);
    if(isNaN(cycles)){
      this.error(`invalid cycle count ${n}`);
      return;
    }

    // Since we are running the machine synchronously, we must
    // decide what to do.
    const ret = this.vm.step(cycles);
    switch(ret){
      case 'continue':
      case 'break':
        break;
      case 'wait':
      case 'halt':
        this.resolvable.resolve(undefined);
        return Debugger.Done;
    }

    return await this.info();
  }

  private async continue(): Promise<CommandHandlerResult> {
    // help: continue -- continue executing the virtual machine.

    // Since when we broke we skipped executing the breaking instruction,
    // we must execute it manually. Then we can continue.
    this.vm.step(1);
    this.resolvable.resolve(undefined);
    return Debugger.Done;
  }

  private async where(count?: string): Promise<CommandHandlerResult> {
    // help: where [count] -- display decoding of current and nearby instructions.
    return this.decode(this.state.registers[Register.IP].toString(), count);
  }

  private async decode(address: string, count: string = '8', high: string = ''): Promise<CommandHandlerResult> {
    // help: decode [count] [max] -- decode instructions.
    if(arguments.length === 0){
      this.write('d <address> [count]');
      return;
    }

    // Parse arguments.
    const addr = this.parseValue(address);
    const window = this.parseWindow(addr, count, high);
    if(isNaN(addr) || window === undefined){
      this.error(`invalid arguments`);
      return;
    }

    // Make a window on the code.
    const program = Program.decode(this.memory.createView(window.low, window.high - window.low));
    program.instructions.forEach((instruction, i) => {
      const color = i + window.low === addr ? Color.Blue : Color.Green;
      this.write(`${this.color(Immediate.toString(window.low + i), color)}: ${instruction.toString()}`);
    });
  }

  private async mem(address: string, count: string = '16', high: string = '', reverse?: string): Promise<CommandHandlerResult> {
    // help: memory <address> [count] [max] -- display a memory dump.
    if(arguments.length === 0){
      this.write('d <address> [count]');
      return;
    }

    // Parse arguments.
    const addr = this.parseValue(address);
    const window = this.parseWindow(addr, count, high);
    if(isNaN(addr) || window === undefined){
      this.error(`invalid arguments`);
      return;
    }

    // Make a window on the code.
    const memory = this.memory.createView(window.low, window.high - window.low);
    memory.forEach((data, i) => {
      if(reverse){
        i = memory.length - i - 1;
        data = memory[i];
      }

      const color = i + window.low === addr ? Color.Blue : Color.Green;
      this.write(`${this.color(Immediate.toString(window.low + i), color)}: ${Immediate.toString(data)}`);
    });
    return;
  }

  private parseValue(value: string): number {
    try {
      const r = Register.parse(value);
      return this.state.registers[r];
    }
    catch(e){}

    return Immediate.parse(value);
  }

  private parseWindow(base: Address, count: string, high: string){
    const c = Immediate.parse(count);
    let h = high ? Immediate.parse(high) : c;
    if(isNaN(c) || isNaN(h)){
      return;
    }

    return {
      low: Math.max(0, base - c - 1),
      high: Math.min(this.memory.length, base + h + 1),
    };
  }

  private parse(input: string): ParsedCommand | undefined {
    const [ command, ...args ] = input.trim().split(/\s+/).filter((part) => !!part);

    // Find the right command; prefer full match, then first
    // command in the list with the parsed command as a prefix.
    let fn = this.commands[command];
    if(!fn){
      const fullCommand = this.commandNames.find((commandName) => {
        return commandName.indexOf(command) === 0;
      });
      if(fullCommand){
        fn = this.commands[fullCommand];
      }
    }
    if(!fn){
      return;
    }

    return {
      command: fn,
      args,
    };
  }

  private onLine(input: string){
    // Ignore empty lines.
    input = input.trim();
    if(!input && this.interface){
      this.interface.prompt();
      return;
    }

    // Parse input.
    const parsed = this.parse(input);

    // Unknown command.
    if(parsed === undefined){
      this.error(`unknown command ${input}`);
      this.interface?.prompt();
      return;
    }

    // Found command.
    parsed.command.apply(this, parsed.args).then((result) => {
      if(result === undefined && this.interface){
        this.interface.prompt();
      }
    });
  }

  private onClose(){
    throw new Error('close!');
  }

  private write(s: string){
    process.stdout.write(s + '\n');
  }

  private error(s: string){
    process.stderr.write(this.color(s, Color.Red) + '\n');
  }

  private color(s: string, color: Color){
    return Color.escape(s, color);
  }
}

export { Debugger }