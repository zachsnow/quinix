import { InternalError, Syntax, writeOnce } from '@/lib/util';
import { logger } from '@/lib/logger';
import {
  ConstantDirective, ReferenceConstant,
  InstructionDirective,
  LabelDirective,

  AssemblyProgram,
  ImmediateConstant,
} from '@/assembly/assembly';
import { indent } from '@/lib/util';
import { TypeTable } from './tables';
import { Type, TypedStorage, PointerType, ArrayType, SliceType } from './types';
import { Expression, IntLiteralExpression } from './expressions';
import { Compiler, StorageCompiler, FunctionCompiler } from './compiler';
import { TypeChecker, KindChecker } from './typechecker';
import { Instruction, Operation } from '@/vm/instructions';

const log = logger('lowlevel:statements');

///////////////////////////////////////////////////////////////////////
// Statements.
///////////////////////////////////////////////////////////////////////
abstract class Statement extends Syntax {
  /**
   * Apply the given type substitution to this statement, returning a
   * new statement. Does not modify this statement.
   *
   * @param typeTable the type substitution to apply.
   */
  public abstract substitute(typeTable: TypeTable): Statement;

  /**
   *
   * @param context
   */
  public abstract typecheck(context: TypeChecker): void;

  /**
   *
   * @param compiler
   */
  public abstract compile(compiler: Compiler): void;

  /**
   * Returns `true` if all paths through this statement reach
   * a `return`.
   */
  public returns(): boolean {
    return false;
  }

  public static compile(s: Statement): AssemblyProgram {
    const compiler = new Compiler('statement');
    s.compile(compiler);
    return new AssemblyProgram(compiler.compile());
  }
}

class BlockStatement extends Statement {
  public constructor(
    private readonly statements: readonly Statement[],
  ) {
    super();
  }

  public substitute(bindings: TypeTable): BlockStatement {
    return new BlockStatement(
      this.statements.map((statement) => {
        return statement.substitute(bindings);
      }),
    ).at(this.location);
  }

  public typecheck(context: TypeChecker): void {
    // Use a nested symbol table so that identifiers created inside the block
    // don't leak outside of the block.
    const nestedContext = context.extend(context.symbolTable.extend());
    this.statements.forEach((statement) => {
      statement.typecheck(nestedContext);
    });
  }

  public compile(compiler: Compiler): void {
    // TODO: nested blocks mean that allocating a variable
    // gets a different name.
    this.statements.forEach((statement) => {
      statement.compile(compiler);
    });
  }

  public returns(): boolean {
    // If all paths through any statement in the block
    // return, then the block returns (and statements after
    // the returning statement area dead).
    //
    // TODO: warn on dead code.
    return this.statements.some((statement) => {
      return statement.returns();
    });
  }

  public toString(): string {
    return '{' + indent('\n' + this.statements.join('\n')) + '\n}';
  }
}

class VarStatement extends Statement {
  private inferredType!: Type;
  private identity!: string;

  public constructor(
    private readonly identifier: string,
    private readonly type?: Type,
    private readonly expression?: Expression,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): VarStatement {
    return new VarStatement(
      this.identifier,
      this.type ? this.type.substitute(typeTable) : undefined,
      this.expression ? this.expression.substitute(typeTable) : undefined,
    ).at(this.location);
  }

  public typecheck(context: TypeChecker): void {
    if (!this.type && !this.expression) {
      this.error(context, `expected type or expression`);
      return;
    }

    // Check that the type of the variable we are defining is valid.
    if (this.type) {
      this.type.kindcheck(context, new KindChecker());
      this.inferredType = this.type.evaluate();
    }

    // Check that the expression has the same type as the variable we are defining.
    // We allow conversion for easier use of literals.
    if (this.expression) {
      const actualType = this.expression.typecheck(context, this.type);
      if (this.type && !actualType.isConvertibleTo(this.type)) {
        this.error(context, `expected ${this.type}, actual ${actualType}`);
      }
      else if (!this.type) {
        this.inferredType = actualType;
      }
    }

    // At this point we should have an inferred type or an error.
    //
    // Update the symbol table so subsequent statements in this block
    // (and in nested blocks) can use it.
    this.identity = context.symbolTable.set(this.identifier, new TypedStorage(this.inferredType, 'local'));
  }

  public compile(compiler: Compiler): void {
    // We can only compile a return statement when we are compiling a function.
    if (!(compiler instanceof StorageCompiler)) {
      throw new InternalError(`unable to compile ${this} outside of a function`);
    }

    // Create storage for this variable.
    compiler.allocateStorage(this.identity, this.inferredType.size);

    // Local declarations without initializers zero out the space.
    if (!this.expression) {
      const vr = compiler.allocateRegister();
      const r = compiler.allocateRegister();

      compiler.emitIdentifier(this.identity, 'local', vr, false);
      compiler.emit([
        new ConstantDirective(r, new ImmediateConstant(0)),
      ]);
      compiler.emitStaticStore(vr, r, this.inferredType.size, 'zero out');

      compiler.deallocateRegister(vr);
      compiler.deallocateRegister(r);
      return;
    }

    let er = this.expression.compile(compiler);

    // Get the address of the local.
    const r = compiler.allocateRegister();
    compiler.emitIdentifier(this.identity, 'local', r, false);

    // Handle type conversions (e.g., array-to-slice, pointer-to-array-to-slice).
    er = compiler.emitConversion(er, this.expression.concreteType, this.inferredType);

    // Store to that address.
    if (this.inferredType.integral) {
      compiler.emitStaticStore(r, er, 1, `${this}`);
    }
    else {
      compiler.emitStaticCopy(r, er, this.inferredType.size, `${this}`);
    }

    compiler.deallocateRegister(er);
    compiler.deallocateRegister(r);
  }

  public toString() {
    if (this.expression && this.type) {
      return `var ${this.identifier}: ${this.type} = ${this.expression};`;
    }
    else if (this.expression) {
      return `var ${this.identifier} = ${this.expression}`;
    }
    else if (this.type) {
      return `var ${this.identifier}: ${this.type};`
    }
    else {
      throw new InternalError(`var statement with neither type nor expression`);
    }
  }
}
writeOnce(VarStatement, 'inferredType');
writeOnce(VarStatement, 'identity');

class AssignmentStatement extends Statement {
  public constructor(
    private readonly assignable: Expression,
    private readonly expression: Expression,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): AssignmentStatement {
    return new AssignmentStatement(
      this.assignable.substitute(typeTable),
      this.expression.substitute(typeTable),
    ).at(this.location);
  }

  public typecheck(context: TypeChecker): void {
    // The assignable should have the same type as the expression being assigned.
    const expectedType = this.assignable.typecheck(context);
    const actualType = this.expression.typecheck(context, expectedType);

    // Allow conversion.
    if (!actualType.isConvertibleTo(expectedType)) {
      this.error(context, `expected ${expectedType}, actual ${actualType}`);
    }

    // Verify that the left side is indeed assignable.
    if (!this.assignable.assignable) {
      this.error(context, `expected ${this.assignable} to be assignable`);
    }

    // Verify that the left hand side hasn't been tagged constant.
    if (expectedType.tagged('.constant')) {
      this.error(context, `expected non-constant assignable, actual ${expectedType.withTags(expectedType.toString())}`);
    }
  }

  public compile(compiler: Compiler): void {
    const ar = this.assignable.compile(compiler, true);
    let er = this.expression.compile(compiler);

    // Handle type conversions (e.g., array-to-slice, pointer-to-array-to-slice).
    er = compiler.emitConversion(er, this.expression.concreteType, this.assignable.concreteType);

    // Special case: if we are assigning to `len` we need to ensure
    // that the length we are assigning is less than or equal to the capacity
    // of the array.
    this.assignable.compileAssignmentCheck(compiler, ar, er);

    if (this.assignable.concreteType.integral) {
      compiler.emitStaticStore(ar, er, 1, `${this}`);
    }
    else {
      compiler.emitStaticCopy(ar, er, this.assignable.concreteType.size, `${this}`);
    }

    compiler.deallocateRegister(ar);
    compiler.deallocateRegister(er);
  }

  public toString() {
    return `${this.assignable} = ${this.expression};`;
  }
}

class ExpressionStatement extends Statement {
  private type?: Type;

  public constructor(
    private readonly expression: Expression,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): ExpressionStatement {
    return new ExpressionStatement(
      this.expression.substitute(typeTable),
    ).at(this.location).tag(this.tags);
  }

  public typecheck(context: TypeChecker): void {
    const type = this.expression.typecheck(context);

    if (!type.isConvertibleTo(Type.Void)) {
      this.lint(context, `expected ${Type.Void}, actual ${type}`);
    }

    this.type = type;
  }

  public compile(compiler: Compiler): void {
    const r = this.expression.compile(compiler);
    compiler.deallocateRegister(r);
  }

  public toString() {
    return `${this.expression};`;
  }

  public returns() {
    if (!this.type) {
      throw new InternalError(`${this} has not been typechecked`);
    }
    return this.type.tagged('.abort');
  }
}

class IfStatement extends Statement {
  public constructor(
    private readonly condition: Expression,
    private readonly ifBranch: BlockStatement,
    private readonly elseBranch?: BlockStatement,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): IfStatement {
    return new IfStatement(
      this.condition.substitute(typeTable),
      this.ifBranch.substitute(typeTable),
      this.elseBranch ? this.elseBranch.substitute(typeTable) : undefined,
    ).at(this.location);
  }

  public typecheck(context: TypeChecker): void {
    const conditionType = this.condition.typecheck(context);

    // Integer conditions -- numbers, pointers, function pointers. We exclude
    // arrays even though they are integral because they are always truthy.
    if (!conditionType.integral) {
      this.error(context, `expected integral type, actual ${conditionType}`);
    }

    this.ifBranch.typecheck(context);
    if (this.elseBranch) {
      this.elseBranch.typecheck(context);
    }
  }

  public compile(compiler: Compiler): void {
    // Evaluate condition.
    const cr = this.condition.compile(compiler);

    const elseRef = compiler.generateReference('else');
    const endRef = compiler.generateReference('if_end');
    const r = compiler.allocateRegister();

    // If the condition is false (0), jump to the else branch.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(elseRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JZ, undefined, cr, r))
    ]);

    // Otherwise, fall through to the if branch.
    this.ifBranch.compile(compiler);

    // Jump to the end.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);

    // Else branch.
    compiler.emit([
      new LabelDirective(elseRef),
    ]);
    this.elseBranch?.compile(compiler);

    // End.
    compiler.emit([
      new LabelDirective(endRef),
    ]);

    compiler.deallocateRegister(cr);
    compiler.deallocateRegister(r);
  }

  public returns(): boolean {
    // Only if/else expressions in which *both* branches always return, always return.
    return this.ifBranch.returns() && (!!this.elseBranch && this.elseBranch.returns());
  }

  public toString() {
    if (!this.elseBranch) {
      return `if(${this.condition}) ${this.ifBranch}`;
    }
    return `if(${this.condition}) ${this.ifBranch} else ${this.elseBranch}`;
  }

  public static build(condition: Expression, ifBlock: BlockStatement, elseIfTail: readonly [Expression, BlockStatement][], elseBlock?: BlockStatement) {
    const elseTail = elseIfTail.reduce((elseBlock, [condition, ifBlock]) => {
      return new BlockStatement([new IfStatement(condition, ifBlock, elseBlock)]);
    }, elseBlock);

    return new IfStatement(condition, ifBlock, elseTail);
  }
}

class ForStatement extends Statement {
  public constructor(
    private readonly initializer: Statement,
    private readonly condition: Expression,
    private readonly update: Statement,
    private readonly block: BlockStatement,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): ForStatement {
    return new ForStatement(
      this.initializer.substitute(typeTable),
      this.condition.substitute(typeTable),
      this.update.substitute(typeTable),
      this.block.substitute(typeTable),
    ).at(this.location);
  }

  public typecheck(context: TypeChecker): void {
    // Create a new scope for the for loop's initializer and body.
    const nestedContext = context.extend(context.symbolTable.extend());

    this.initializer.typecheck(nestedContext);

    const conditionType = this.condition.typecheck(nestedContext);

    // Integer conditions and pointer conditions are allowed.
    if (!conditionType.integral) {
      this.error(nestedContext, `expected integral type, actual ${conditionType}`);
    }

    this.update.typecheck(nestedContext);

    this.block.typecheck(nestedContext.loop());

    return;
  }

  public compile(compiler: Compiler) {
    // Initializer.
    this.initializer.compile(compiler);

    const topRef = compiler.generateReference('for');
    const endRef = compiler.generateReference('for_end');
    const r = compiler.allocateRegister();

    compiler.emit([
      new LabelDirective(topRef),
    ]);

    const cr = this.condition.compile(compiler);

    // If the condition is false (0), jump to the end.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JZ, undefined, cr, r))
    ]);

    // For loop body.
    compiler.loop(endRef, () => {
      this.block.compile(compiler);
    });

    this.update.compile(compiler);

    // Return to the top.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(topRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);

    // End.
    compiler.emit([
      new LabelDirective(endRef),
    ]);

    compiler.deallocateRegister(cr);
    compiler.deallocateRegister(r);
  }

  public toString() {
    return `for(${this.initializer} ${this.condition}; ${this.update}) ${this.block}`;
  }
}

class WhileStatement extends Statement {
  public constructor(
    private readonly condition: Expression,
    private readonly block: BlockStatement,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): WhileStatement {
    return new WhileStatement(
      this.condition.substitute(typeTable),
      this.block.substitute(typeTable),
    ).at(this.location);
  }

  public typecheck(context: TypeChecker): void {
    const conditionType = this.condition.typecheck(context);

    // Integer conditions and pointer conditions are allowed.
    if (!conditionType.integral) {
      this.error(context, `expected integral type, actual ${conditionType}`);
    }

    this.block.typecheck(context.loop());
  }

  public compile(compiler: Compiler): void {
    const topRef = compiler.generateReference('while');
    const endRef = compiler.generateReference('while_end');
    const r = compiler.allocateRegister();

    compiler.emit([
      new LabelDirective(topRef),
    ]);

    const cr = this.condition.compile(compiler);

    // If the condition is false (0), jump to the end.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(endRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JZ, undefined, cr, r))
    ]);

    // While loop body.
    compiler.loop(endRef, () => {
      this.block.compile(compiler);
    });

    // Return to the top.
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(topRef)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);

    // End.
    compiler.emit([
      new LabelDirective(endRef),
    ]);

    compiler.deallocateRegister(cr);
    compiler.deallocateRegister(r);
  }

  public toString() {
    return `while(${this.condition}) ${this.block}`;
  }
}

/**
 * A return statement of the form `return;` or `return expression;`.
 */
class ReturnStatement extends Statement {
  private returnType!: Type;

  public constructor(
    private readonly expression?: Expression,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): ReturnStatement {
    return new ReturnStatement(
      this.expression ? this.expression.substitute(typeTable) : undefined,
    ).at(this.location);
  }

  public typecheck(context: TypeChecker): void {
    const storage = context.symbolTable.get('return').value;
    const returnType = this.expression ? this.expression.typecheck(context, storage.type) : Type.Void;

    if (!returnType.isEqualTo(storage.type)) {
      this.error(context, `expected ${storage.type}, actual ${returnType}`);
    }

    this.returnType = storage.type;
  }

  public compile(compiler: Compiler): void {
    // We can only compile a return statement in the context of a function.
    if (!(compiler instanceof FunctionCompiler)) {
      throw new InternalError(`unable to compile return outside of a function`);
    }

    // If we have an expression, evaluate it, otherwise just evaluate 0. Then move the evaluation
    // to the return register.
    const expression = this.expression || new IntLiteralExpression(0);
    let r = expression.compile(compiler);

    // Handle type conversions (e.g., array-to-slice, pointer-to-array-to-slice).
    if (this.expression) {
      r = compiler.emitConversion(r, this.expression.concreteType, this.returnType);
    }

    if (!this.returnType.integral && !this.returnType.isConvertibleTo(Type.Void)) {
      // We need to copy the value pointed to by `r` into the first function parameter called `$return`.
      const dr = compiler.allocateRegister();
      compiler.emitIdentifier('$return', 'parameter', dr, true);
      compiler.emitStaticCopy(dr, r, this.returnType.size, 'copy return data');
      compiler.emitMove(r, dr);
      compiler.deallocateRegister(dr);
    }

    compiler.emitReturn(r);
    compiler.deallocateRegister(r);
  }

  public returns(): boolean {
    return true;
  }

  public toString() {
    if (this.expression) {
      return `return ${this.expression};`;
    }
    return `return;`;
  }
}
writeOnce(ReturnStatement, 'returnType');

class BreakStatement extends Statement {
  public substitute(typeTable: TypeTable) {
    return this;
  }

  public typecheck(context: TypeChecker): void {
    if (!context.inLoop) {
      this.error(context, `break outside of for or while`);
    }
  }

  public compile(compiler: Compiler): void {
    if (!compiler.breakReference) {
      throw new InternalError(`unable to compile break outside of a for or while statement`);
    }

    const r = compiler.allocateRegister();
    compiler.emit([
      new ConstantDirective(r, new ReferenceConstant(compiler.breakReference)),
      new InstructionDirective(Instruction.createOperation(Operation.JMP, undefined, r)),
    ]);
    compiler.deallocateRegister(r);
  }

  public returns(): boolean {
    return false;
  }

  public toString() {
    return `break;`;
  }
}

/**
 * A delete statement of the form `delete expression;`.
 */
class DeleteStatement extends Statement {
  public constructor(
    private readonly expression: Expression,
  ) {
    super();
  }

  public substitute(typeTable: TypeTable): DeleteStatement {
    return new DeleteStatement(
      this.expression.substitute(typeTable),
    ).at(this.location);
  }

  public typecheck(context: TypeChecker): void {
    const type = this.expression.typecheck(context);
    const cType = type.resolve();

    if (!(cType instanceof PointerType) && !(cType instanceof ArrayType) && !(cType instanceof SliceType)) {
      this.error(context, `expected array, slice, or pointer type, actual ${type}`);
    }

    // For slices, we need to zero out the descriptor fields, so it must be assignable
    if (cType instanceof SliceType && !this.expression.assignable) {
      this.error(context, `cannot delete non-assignable slice expression ${this.expression}`);
    }
  }

  public compile(compiler: Compiler): void {
    const dr = this.expression.compile(compiler);
    const cType = this.expression.concreteType.resolve();

    if (cType instanceof SliceType) {
      // For slices, we need to:
      // 1. Load the pointer field (first word of the slice descriptor)
      // 2. Delete the heap memory pointed to by that pointer
      // 3. Zero out all three fields (pointer, length, capacity)

      // Load the pointer field (word 0)
      const ptrReg = compiler.allocateRegister();
      compiler.emit([
        new InstructionDirective(
          Instruction.createOperation(Operation.LOAD, ptrReg, dr)
        ).comment('load slice.pointer'),
      ]);

      // Delete the heap memory
      compiler.emitDelete(ptrReg, 'delete slice data');
      compiler.deallocateRegister(ptrReg);

      // Zero out the slice descriptor fields
      const zeroReg = compiler.allocateRegister();
      compiler.emit([
        new ConstantDirective(zeroReg, new ImmediateConstant(0)).comment('zero'),
      ]);

      // Store 0 to pointer field (offset 0)
      compiler.emitStaticStore(dr, zeroReg, 1, 'slice.pointer = null');

      // Store 0 to length field (offset 1)
      compiler.emitIncrement(dr, 1);
      compiler.emitStaticStore(dr, zeroReg, 1, 'slice.length = 0');

      // Store 0 to capacity field (offset 2)
      compiler.emitIncrement(dr, 1);
      compiler.emitStaticStore(dr, zeroReg, 1, 'slice.capacity = 0');

      compiler.deallocateRegister(zeroReg);
      compiler.deallocateRegister(dr);
    }
    else {
      // For pointers and arrays, delete directly
      compiler.emitDelete(dr);
    }
  }

  public returns(): boolean {
    return false;
  }

  public toString() {
    return `delete ${this.expression};`;
  }
}

export {
  Statement,
  BlockStatement,
  ExpressionStatement,
  VarStatement,
  DeleteStatement,
  IfStatement,
  ForStatement, WhileStatement,
  AssignmentStatement,
  ReturnStatement,
  BreakStatement,
};
