/**
 * Parser prelude -- this is the Peggy-generated parsers, so that the semantic
 * actions associated with the parsers can be correctly typed.
 */
import {
  Directive,
  ConstantDirective,
  ImmediateConstant,
  ReferenceConstant,
  DataDirective,
  TextData,
  ImmediatesData,
  ReferenceData,
  InstructionDirective,
  LabelDirective,
  Reference,
  AssemblyProgram,
} from "./assembly";
import { Instruction, Operation, Register } from "../vm/instructions";
