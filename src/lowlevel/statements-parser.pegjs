///////////////////////////////////////////////////////////////////////
// Statements.
///////////////////////////////////////////////////////////////////////
Statement
    = s:LineStatement _ ";" { return s; }
    / BlockStatement

LineStatement
    = "var" _ ti:TypedIdentifier _ "=" _ e:Expression { return new VarStatement(ti.identifier, ti.type, e).at(location(), text(), options); }
    / "var" _ id:Identifier _ "=" _ e:Expression { return new VarStatement(id, undefined, e).at(location(), text(), options); }
    / "var" _ ti:TypedIdentifier { return new VarStatement(ti.identifier, ti.type).at(location(), text(), options); }

    / "return" _ e:Expression { return new ReturnStatement(e).at(location(), text(), options); }
    / "return" { return new ReturnStatement().at(location(), text(), options); }

    / "break" { return new BreakStatement().at(location(), text(), options); }

    / "delete" _ e:Expression { return new DeleteStatement(e).at(location(), text(), options); }

    / e1:Expression _ "=" _ e2:Expression { return new AssignmentStatement(e1, e2).at(location(), text(), options); }
    / e:Expression { return new ExpressionStatement(e).at(location(), text(), options); }

BlockStatement
    = "if" _ "(" _ e:Expression _ ")" _ ifBlock:Block
        ifElseTail:(_ "else" _ "if" _ "(" _ Expression _ ")" _ Block)*
        elseOptional:(_ "else" _ elseBlock:Block)? {
            return IfStatement.build(
                e,
                ifBlock,
                ifElseTail.map((tail: any) => [ tail[7], tail[11] ]),
                elseOptional ? elseOptional[3] : undefined,
            ).at(location(), text(), options);
        }
    / "for" _ "(" _ init:LineStatement _ ";" _ e:Expression _ ";" _ update:LineStatement _ ")" _ b:Block {
        return new ForStatement(init, e, update, b).at(location(), text(), options);
    }
    / "while" _ "(" _ e:Expression _ ")" _ b:Block {
        return new WhileStatement(e, b).at(location(), text(), options);
    }

Block
    = "{" _ stms:StatementList? _ "}" { return new BlockStatement(stms || []).at(location(), text(), options); }

StatementList
    = stm:Statement stms:(_ Statement)* { return [stm, ...stms.map((stm: any) => stm[1])]; }
