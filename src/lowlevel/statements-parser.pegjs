///////////////////////////////////////////////////////////////////////
// Statements.
///////////////////////////////////////////////////////////////////////
Statement
    = s:LineStatement _ ";" { return s; }
    / BlockStatement

LineStatement
    = VarToken _ ti:TypedIdentifier _ "=" _ e:Expression { return new VarStatement(ti.identifier, ti.type, e).at(location(), text(), options); }
    / VarToken _ ti:TypedIdentifier { return new VarStatement(ti.identifier, ti.type).at(location(), text(), options); }
    / VarToken _ id:Identifier _ "=" _ e:Expression { return new VarStatement(id, undefined, e).at(location(), text(), options); }

    / ReturnToken _ e:Expression { return new ReturnStatement(e).at(location(), text(), options); }
    / ReturnToken { return new ReturnStatement().at(location(), text(), options); }

    / BreakToken { return new BreakStatement().at(location(), text(), options); }
    / ContinueToken { return new ContinueStatement().at(location(), text(), options); }

    / DeleteToken _ e:Expression { return new DeleteStatement(e).at(location(), text(), options); }

    / e1:Expression _ "=" _ e2:Expression { return new AssignmentStatement(e1, e2).at(location(), text(), options); }
    / e:Expression { return new ExpressionStatement(e).at(location(), text(), options); }

BlockStatement
    = IfToken _ "(" _ e:Expression _ ")" _ ifBlock:Block
        ifElseTail:(_ ElseToken _ IfToken _ "(" _ Expression _ ")" _ Block)*
        elseOptional:(_ ElseToken _ elseBlock:Block)? {
            return IfStatement.build(
                e,
                ifBlock,
                ifElseTail.map((tail: any) => [ tail[7], tail[11] ]),
                elseOptional ? elseOptional[3] : undefined,
            ).at(location(), text(), options);
        }
    / ForToken _ "(" _ init:LineStatement _ ";" _ e:Expression _ ";" _ update:LineStatement _ ")" _ b:Block {
        return new ForStatement(init, e, update, b).at(location(), text(), options);
    }
    / WhileToken _ "(" _ e:Expression _ ")" _ b:Block {
        return new WhileStatement(e, b).at(location(), text(), options);
    }

Block
    = "{" _ stms:StatementList? _ "}" { return new BlockStatement(stms || []).at(location(), text(), options); }

StatementList
    = stm:Statement stms:(_ Statement)* { return [stm, ...stms.map((stm: any) => stm[1])]; }
