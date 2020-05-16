import fs from 'fs';
import debug from 'debug';
import { parse } from 'src/lowlevel/parser';

class InternalError extends Error {
  public constructor(message?: string){
    super(message ? `internal: ${message}` : `internal`);
  }
}

class SymbolTable<T> {
  private id: number = 0;
  private symbols: { [key: string]: T } = {};

  public constructor(
    private readonly parent?: SymbolTable<T>,
  ){
    if(parent){
      this.id = parent.id + 1;
    }
  }

  public extend(): SymbolTable<T> {
    return new SymbolTable<T>(this);
  }

  private identify(identifier: string): string {
    return `${identifier}$${this.id}`;
  }

  /**
   * Tries to get the value associated with the given fully qualified
   * identifier, along with the identity of the scope in which it was found.
   * Returns `undefined` if it was not found.
   * @param identifier
   */
  public lookup(identifier: string): { value: T, identity: string } | undefined {
    if(this.has(identifier)){
      return this.get(identifier);
    }
  }

  /**
   * Gets the value associated with the given fully qualified identifier,
   * along with the identity of the scope in which it was found. Raises
   * an error if it was not found.
   *
   * @param qualifiedIdentifier the fully qualified identifier to get.
   */
  public get(identifier: string): { value: T, identity: string } {
    const value = this.symbols[identifier];
    if(value !== undefined){
      return {
        identity: this.identify(identifier),
        value,
      };
    }
    if(this.parent !== undefined){
      return this.parent.get(identifier);
    }
    throw new InternalError(`unknown identifier ${identifier}`);
  }

  /**
   * Sets the value associated with the given fully qualified identifier;
   * raises an error if it has already been set in *this* table, while
   * allowing shadowing *parent* tables.
   *
   * @param qualifiedIdentifier the fully qualified identifier to set.
   * @param value the value to set.
   */
  public set(identifier: string, value: T): string {
    if(this.symbols[identifier] !== undefined){
      throw new InternalError(`identifier redefinition ${identifier}: ${this.symbols[identifier]}`);
    }
    this.symbols[identifier] = value;
    return this.identify(identifier);
  }

  /**
   * Determines whether this table contains the fully qualified identifier.
   *
   * @param qualifiedIdentifier the fully qualified identifier to check the presence of.
   */
  public has(qualifiedIdentifier: string): boolean {
    const value = this.symbols[qualifiedIdentifier];
    if(value !== undefined){
      return true;
    }
    if(this.parent !== undefined){
      return this.parent.has(qualifiedIdentifier);
    }
    return false;
  }
}

function indent(s: string, indent: number = 1): string {
  const indentation = new Array(indent).fill('  ').join('');
  return s.replace(/\n/g, '\n' + indentation);
}

function flatten<T>(array: readonly T[][]): T[] {
  const result: T[] = [];
  array.forEach((arr) => {
    arr.forEach((el) => {
      result.push(el);
    });
  });
  return result;
}

function duplicates<T>(array: readonly T[]): T[] {
  const duplicates: T[] = [];
  array.forEach((s, index) => {
    if(array.indexOf(s) !== index){
      duplicates.push(s);
    }
  });
  return duplicates;
}

function unique<T>(array: T[]): T[] {
  const uniques: T[] = [];
  array.forEach((s, index) => {
    if(array.indexOf(s) === index){
      uniques.push(s);
    }
  });
  return uniques;
}

function logger(name: string): debug.Debugger {
  return debug(name);
}

async function readFiles(filenames: string[]): Promise<string[]> {
  return await Promise.all(filenames.map((filename) => fs.promises.readFile(filename, 'utf-8')));
}

class HasTags {
  protected tags: string[] = [];

  /**
   * Tags this type with the given tags.
   *
   * @param tags the tags to tag this type with.
   */
  public tag(tags: readonly string[] = []): this {
    this.tags.push(...tags);
    this.tags = unique(this.tags);
    return this;
  }

  /**
   * Checks if this type is tagged with the given tag.
   *
   * @param tag the tag to check.
   */
  public tagged(tag: string): boolean {
    return this.tags.indexOf(tag) !== -1;
  }

  /**
   * Prepends the given method with this object's tags.
   *
   * @param message the message to prepend with this object's tags.
   */
  public withTags(message: string): string {
    return this.tags.length ?
      `${this.tags.join(' ')} ${message}` :
      message;
  }
}

class Location {
  public constructor(private filename: string, private line: number, private column: number, private text: string){}

  public toString(){
    const parts = this.text.split('\n');
    const text = parts.length > 1 ? `${parts[0]}...` : this.text;
    return `${this.filename}(${this.line})[${this.column}]: ${text}`;
  }
}

interface IParseOptions {
  filename?: string;
  [key: string]: any;
}

interface IFilePosition {
  line: number;
  column: number;
}

interface IFileRange {
  start: IFilePosition;
}


class Syntax extends HasTags {
  protected location?: Location;

  public at(location?: Location): this;
  public at(range: IFileRange, text: string, options?: IParseOptions): this;
  public at(locationOrRange?: Location | IFileRange, text?: string, options?: IParseOptions): this {
    if(locationOrRange === undefined){
      this.location = undefined;
    }
    else if(locationOrRange instanceof Location){
      this.location = locationOrRange;
    }
    else {
      this.location = new Location(options?.filename || 'stdin', locationOrRange.start.line, locationOrRange.start.column, text!);
    }
    return this;
  }

  public error(messages: Messages, message: string): void {
    messages.error(message, this.location);
  }

  public warning(messages: Messages, message: string): void {
    messages.warning(message, this.location);
  }

  public lint(messages: Messages, message: string): void {
    // Nothin' for now.
  }

  public withLocation(s: string){
    if(!this.location){
      return s;
    }
    return `${this.location}: ${s}`;
  }
}


type MessageType = 'error' | 'warning';

class Message {
  public readonly type: MessageType;
  public readonly location?: Location;
  public readonly text: string;

  public constructor(type: MessageType, text: string, location?: Location){
    this.type = type;
    this.text = text;
    this.location = location;
  }

  public toString(){
    if(this.location !== undefined){
      return `${this.type}: ${this.location}: ${this.text}`;
    }
    return `${this.type}: ${this.text}`;
  }
}

class Messages {
  protected messages: Message[] = [];

  public error(message: string, location?: Location){
    this.messages.push(new Message('error', message, location));
  }

  public warning(message: string, location?: Location){
    this.messages.push(new Message('warning', message, location));
  }

  public get errors(): Message[] {
    return this.messages.filter((message) => message.type === 'error');
  }

  public get warnings(): Message[] {
    return this.messages.filter((message) => message.type === 'warning');
  }

  public toString(){
    return this.messages.join('\n');
  }

  public get length(): number {
    return this.messages.length;
  }
}

class ResolvablePromise<T> {
  private resolver!: (result: T) => void;
  private rejecter!: (e: any) => void;
  public readonly promise: Promise<T>;

  public constructor(){
    this.promise = new Promise((resolve, reject) => {
      this.resolver = resolve;
      this.rejecter = reject;
    });
  }

  public resolve(result: T){
    this.resolver(result);
  }

  public reject(e: any){
    this.rejecter(e);
  }
}

function release(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve);
  });
}

/**
 * Parse a file with the given parser; attaches filename information to any thrown `SyntaxError`.
 *
 * @param parser a PEGjs parse function.
 * @param text the text to parse.
 * @param filename the filename of the source of the text.
 */
function parseFile<T>(parser: (text: string, options: IParseOptions) => T, text: string, filename: string = 'stdin', options?: IParseOptions): T {
  options = options || {};
  options.filename = filename;

  try {
    return parser(text, options);
  }
  catch(e){
    if(e.name === 'SyntaxError'){
      e.location.filename = filename;
    }
    throw e;
  }
}

function stringToCodePoints(s: string): number[] {
  return Array.from(s).map((s) => s.codePointAt(0) || 0);
}

function codePointsToString(codePoints: number[]) {
  return codePoints.map((c) => String.fromCodePoint(c)).join('');
}

function range(i: number, j: number): number[] {
  const l = [];
  for(let x = i; x < j; x++){
    l.push(x);
  }
  return l;
}

type Constructor<T> = Function & { prototype: T }
function writeOnce<K, F extends Constructor<K>>(cls: F, key: string, allowUndefined: boolean = false){
  const backingKey = `.${key}`;
  Object.defineProperty(cls.prototype, key, {
    get: function(){
      const value = this[backingKey];
      if(!allowUndefined && value === undefined){
        debugger;
        throw new InternalError(`write-once property ${key} of ${this.constructor.name} not set`);
      }
      return value;
    },
    set: function(value){
      const previousValue = this[backingKey];
      if(this[backingKey] !== undefined && value !== previousValue){
        throw new InternalError(`write-once property ${key} of ${this} already set to ${previousValue}, cannot set to ${value}`);
      }
      this[backingKey] = value;
    },
    enumerable: true,
  });
}

export {
  InternalError,
  indent,
  duplicates, unique, flatten,
  SymbolTable,
  logger,
  readFiles,
  parseFile,
  IParseOptions, IFileRange,
  Syntax,
  Messages,
  ResolvablePromise,
  release,
  stringToCodePoints,
  codePointsToString,
  range,
  writeOnce,
  Location,
}
