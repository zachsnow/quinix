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

// Float conversion helper for parsing float literals
const floatBuffer = new ArrayBuffer(4);
const floatIntView = new Uint32Array(floatBuffer);
const floatFloatView = new Float32Array(floatBuffer);

function floatToInt(f: number): number {
  floatFloatView[0] = f;
  return floatIntView[0];
}
