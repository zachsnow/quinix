import { logger } from '../lib/logger';

import { Memory, Address, Immediate, Offset } from '../lib/base-types';
import { Peripheral } from './peripheral-base';

const log = logger('vm:mmu');

/**
 * Memory access flags.
 */
enum AccessFlags {
  /**
   * Indicates the relevant page is mapped.
   */
  Present = 0b0001,

  /**
   * Indicates the relevant page is readable.
   */
  Read = 0b0010,

  /**
   * Indicates the relevant page is writeable.
   */
  Write = 0b0100,

  /**
   * Indicates the relevant page is executable.
   */
  Execute = 0b1000,
}

namespace AccessFlags {
  const specs: [ AccessFlags, string ][]  = [
    [ AccessFlags.Present, 'present' ],
    [ AccessFlags.Read, 'read' ],
    [ AccessFlags.Write, 'write' ],
    [ AccessFlags.Execute, 'execute' ],
  ];

  /**
   * Converts the given flags to a comma-separated list of
   * flag names.
   *
   * @param flags the flags to convert.
   */
  export function toString(flags: AccessFlags): string {
    return specs.map(([flag, s]) => {
      if(flag & flags){
        return s;
      }
    }).filter((s) => !!s).join(', ');
  }
}

/**
 * The MMU interface that a virtual machine assumes that an MMU will support.
 */
interface MMU {
  /**
   * Enable the MMU; subsequent calls to `translate` should translate the given
   * virtual address.
   */
  enable(): void;

  /**
   * Disable the MMU; subsequent calls to `translate` should return the given
   * virtual address as if it were a physical address, unchaged.
   *
   * TODO: perhaps the virtual machine should maintain the "enabled vs. disabled"
   * state, and only call these methods so the MMU can perform any cleanup it
   * needs to (e.g. clearing caches).
   */
  disable(): void;

  /**
   * Translates the given virtual address to a physical address, or to `undefined`
   * if the address is not mapped, or is mapped with incompatible flags.
   *
   * @param virtualAddress the virtual address to translate.
   * @param flags the requested flags; if the virtual address is not mapped
   * with (a superset of) these flags, return `undefined`.
   */
  translate(virtualAddress: Address, flags: AccessFlags): Address | undefined;

  /**
   * Reset the MMU cache / stored mappings; for testing.
   */
  reset(): void;
}

/**
 * A trivial MMU that simply returns the given `virtualAddress` as it if it were already
 * a `physicalAddress`.
 */
class IdentityMMU implements MMU {
  public enable(){}
  public disable(){}

  public translate(virtualAddress: Address, flags: AccessFlags){
    log.debug(`IdentityMMU: translating ${Immediate.toString(virtualAddress)} ${AccessFlags.toString(flags)}`);
    return virtualAddress;
  }

  public reset(){}
}

/**
 * A cache mapping virtual addresses to physical addresses. The key
 * of the cache is not the *entire* virtual address; instead it is
 * the non-offset bits of the virtual address along with the flags
 * of the page to which the virtual address maps.
 */
type AddressCache = { [virtualAddress: number]: Address };

/**
 * Implements a simplified page table, similar in structure to that implemented
 * by the x86.
 *
 * First we map the top 10 bits of the virtual address to an entry in
 * the first-level table. The top 28 bits of the entry represent the physical address of
 * the second-level table -- which means the second-level table must have 8-byte
 * alignment. The bottom 4 bits of the entry represent the flags.
 *
 * Next we map the next 10 bits of the virtual address to an entry in
 * the second-level table. The top 20 bits of the entry represent the top
 * 20 bits of the physical address. The bottom 4 bits of the entry represent
 * the flags. The remaining 8 bits are unused.
 *
 * Once we have the top 20 bits of the physical address, the bottom 12 bits
 * of the final physical address are filled in from the bottom 12 bits of the
 * virtual address.
 */
class TwoLevelPageTablePeripheral extends Peripheral implements MMU {
  public name = "two-level-page-table";
  public identifier = 0x80000001;

  public io = 0x01;
  public shared = 0x0;

  // MMU implementation.
  private enabled: boolean = false;
  private readonly memory: Memory;
  private baseAddress: Address = 0x0;
  private mru: AddressCache = {};

  public constructor(memory: Memory){
    super();
    this.memory = memory;
  }

  public enable() {
    this.enabled = true;
    this.mru = {};
  }

  public disable() {
    this.enabled = false;
  }

  public reset(){
    this.mru = {};
  }

  public translate(virtualAddress: Address, flag: AccessFlags): Address | undefined {
    // MMU not enabled (e.g. when in an interrupt).
    if(!this.enabled){
      return virtualAddress;
    }

    // MMU not mapped.
    if(this.baseAddress === 0x0){
      return virtualAddress;
    }

    // Decode virtual address.
    const table1Index = (virtualAddress >> 22) & 0b1111111111; // First 10 bits.
    const table2Index = (virtualAddress >> 12) & 0b1111111111; // Next 10 bits.
    const physicalOffset = virtualAddress & 0b111111111111; // Last 12 bits.

    // Check address cache.
    const indexes = table1Index | table2Index;
    let physicalAddress, entryFlags;
    let cachedAddress = this.mru[indexes];
    if(cachedAddress !== undefined){
      physicalAddress = cachedAddress & 0b11111111111111111111000000000000;
      entryFlags = cachedAddress & 0b1111;

      // Check flags.
      if(!(entryFlags & AccessFlags.Present) || !(entryFlags & flag)){
        return;
      }
      return physicalAddress + physicalOffset;
    }

    // Level 1 entry.
    let tableEntry = this.memory[this.baseAddress + table1Index];
    let tableAddress = (tableEntry >> 4) & 0b1111111111111111111111111111; // First 28 bits.
    entryFlags = tableEntry & 0b1111; // Last 4 bits.

    // Check flags.
    if(!(entryFlags & AccessFlags.Present) || !(entryFlags & flag)){
      return;
    }

    // Level 2 entry.
    tableEntry = this.memory[tableAddress + table2Index];
    physicalAddress = tableEntry & 0b111111111111111111110000000000; // Top 20 bits.
    entryFlags = tableEntry & 0b1111; // Last 4 bits.

    // Check flags.
    if(!(entryFlags & AccessFlags.Present) || !(entryFlags & flag)){
      return;
    }

    // Cache address + flags.
    this.mru[indexes] = physicalAddress | entryFlags;

    // Return
    return physicalAddress + physicalOffset;
  }

  public notify(address: Address): void {
    if(!this.mapping){
      this.unmapped();
    }

    this.baseAddress = this.mapping.view[address];
    this.mru = {};
  }
}

type Page = {
  virtualAddress: Address;
  physicalAddress: Address;
  size: Offset;
  flags: AccessFlags;
}

class ListPageTablePeripheral extends Peripheral implements MMU {
  public name = "list-table";
  public identifier = 0x80000002;

  public io = 0x01;
  public shared = 0x0;

  // MMU implementation.
  private enabled: boolean = false;
  private readonly memory: Memory;
  private baseAddress: Address = 0x0;
  private pages: Page[] = [];

  public constructor(memory: Memory){
    super();
    this.memory = memory;
  }

  public enable() {
    this.enabled = true;
    this.pages = this.rebuild();
  }

  public disable() {
    this.enabled = false;
  }

  public reset(){
    this.pages = this.rebuild();
  }

  private rebuild(){
    const pages: Page[] = [];
    const size = this.memory[this.baseAddress];
    for(let i = 0; i < size; i++){
      const page = {
        virtualAddress: this.memory[this.baseAddress + 1 + i * 4 + 0],
        physicalAddress: this.memory[this.baseAddress + 1 + i * 4 + 1],
        size: this.memory[this.baseAddress + 1 + i * 4 + 2],
        flags: this.memory[this.baseAddress + 1 + i * 4 + 3],
      };
      pages.push(page);
    }
    pages.sort((a, b) => {
      return a.virtualAddress - b.virtualAddress;
    });
    return pages;
  }

  public translate(virtualAddress: Address, flag: AccessFlags): Address | undefined {
    // MMU not enabled (e.g. when in an interrupt).
    if(!this.enabled){
      return virtualAddress;
    }

    // MMU not mapped.
    if(this.baseAddress === 0x0){
      return virtualAddress;
    }

    const page = this.pages.find((page) => {
      return virtualAddress >= page.virtualAddress && virtualAddress < page.virtualAddress + page.size;
    });

    // Not mapped.
    if(page === undefined){
      return;
    }

    // Not mapped with correct flags.
    if(!(page.flags & flag)){
      return;
    }

    // Mapped with correct flags, convert to physical address.
    return page.physicalAddress + (virtualAddress - page.virtualAddress);
  }

  public notify(address: Address): void {
    if(!this.mapping){
      this.unmapped();
    }

    this.baseAddress = this.mapping.view[address];
    this.pages = this.rebuild();
  }
}

export {
  AccessFlags,
  IdentityMMU,
  TwoLevelPageTablePeripheral,
  ListPageTablePeripheral,
};
export type { MMU };
