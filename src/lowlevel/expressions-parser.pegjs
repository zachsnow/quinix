///////////////////////////////////////////////////////////////////////
// Expressions.
///////////////////////////////////////////////////////////////////////
Expression
    = ConditionalExpression

PrimaryExpression
    = i:IntLiteral { return new IntLiteralExpression(i).at(location(), text(), options); }
    / StringExpression
    / b:BoolLiteral {  return new BoolLiteralExpression(b).at(location(), text(), options); }
    / ArrayExpression
    / StructExpression
    / "(" e:Expression ")" { return e; }
    / "null" { return new NullExpression().at(location(), text(), options); }
    / "sizeof" _ t:Type { return new SizeOfExpression(t).at(location(), text(), options); }
    / id:QualifiedIdentifier { return new IdentifierExpression(id).at(location(), text(), options); }

ExpressionList
    = e:Expression es:(_ "," _ Expression)* (_ ",")? { return [e, ...es.map((e: any) => e[3])]; }

PostfixExpression
    = e1:PrimaryExpression _ "(" _ args:ExpressionList? _ ")" { return new CallExpression(e1, args || []).at(location(), text(), options); }
    / e:PrimaryExpression tail:(PostfixExpressionSuffix)* { return SuffixExpression.build(e, tail).at(location(), text(), options); }

PostfixExpressionSuffix
    = _ "[" _ e:Expression _ "]" { return SuffixExpression.createIndex(e, location(), text(), options); }
    / _ "." _ id:Identifier { return SuffixExpression.createMember(id, false, location(), text(), options); }
    / _ "->" _ id:Identifier { return SuffixExpression.createMember(id, true, location(), text(), options); }

PrefixExpression
    = op:UnaryOperator _ e:PrefixExpression { return new UnaryExpression(op, e).at(location(), text(), options); }
    / "<" _ u:"unsafe"? _ t:Type _ ">" _ e:PrefixExpression { return new CastExpression(t, e, !!u).at(location(), text(), options); }
    / "new" _ e:NewExpression { return e; }
    / PostfixExpression

NewExpression
    // Struct special case.
    = t:StructExpression { return new NewExpression(t.type, t).at(location(), text(), options); }

    // String special case.
    / t:Type _ e:StringExpression {
        return new NewArrayExpression(t, e, new IntLiteralExpression(e.length), false).at(location(), text(), options);
    }

    // Array special cases.
    / t:Type _ "[" _ n:Expression _ "]" _ el:"..."? _ e:Expression? {
        return new NewArrayExpression(new ArrayType(t), e || undefined, n, !!el).at(location(), text(), options);
    }
    / t:Type _ e:ArrayExpression {
        return new NewArrayExpression(t, e, new IntLiteralExpression(e.length), false).at(location(), text(), options);
    }

    // General case; we expect that `t` should *not* be an arrray type.
    / t:Type _ e:Expression { return new NewExpression(t, e).at(location(), text(), options); }
    / t:Type { return new NewExpression(t).at(location(), text(), options); }

UnaryOperator
    = "*"
    / "+"
    / "-"
    / "!"
    / "&"
    / "!"
    / "len"

MultiplicativeExpression
    = e:PrefixExpression tail:(_ MultiplicativeOperator _ PrefixExpression)* {
        return BinaryExpression.build(e, tail.map((t: any) => [ t[1], t[3] ])).at(location(), text(), options);
    }

MultiplicativeOperator
    = "*"
    / "/"
    / "%"

AdditiveExpression
    = e:MultiplicativeExpression tail:(_ AdditiveOperator _ MultiplicativeExpression)* {
        return BinaryExpression.build(e, tail.map((t: any) => [ t[1], t[3] ])).at(location(), text(), options);
    }

AdditiveOperator
    = "+"
    / "-"

RelationalExpression
    = e:AdditiveExpression tail:(_ RelationalOperator _ AdditiveExpression)? {
        return BinaryExpression.build(e, tail ? [ [tail[1], tail[3]] ] : []).at(location(), text(), options);
    }

RelationalOperator
    = "<="
    / ">="
    / "<"
    / ">"

EqualityExpression
    = e:RelationalExpression tail:(_ EqualityOperator _ RelationalExpression)? {
        return BinaryExpression.build(e, tail ? [ [tail[1], tail[3]] ] : []).at(location(), text(), options);
    }

EqualityOperator
    = "=="
    / "!="

LogicalExpression
    = e:EqualityExpression tail:(_ LogicalOperator _ EqualityExpression)* {
        return BinaryExpression.build(e, tail.map((t: any) => [t[1], t[3]])).at(location(), text(), options);
    }

LogicalOperator
    = "&&"
    / "||"

ConditionalExpression
    = condition:LogicalExpression tail:(_ "?" _ Expression _ ":" _ Expression)* {
        return ConditionalExpression.build(condition, tail.map((t: any) => [ t[3], t[7] ])).at(location(), text(), options);
    }

StringExpression
    = s:StringLiteral { return new StringLiteralExpression(s).at(location(), text(), options); }

ArrayExpression
    = "[" _ args:ExpressionList? _ "]" { return new ArrayLiteralExpression(args || []).at(location(), text(), options); }

StructExpression
    = t:Type _ "{" _ members:MemberExpressionList? _ "}" { return new StructLiteralExpression(t, members || []).at(location(), text(), options); }

MemberExpressionList
    = id:Identifier _ "=" _ e:Expression members:(_ "," _ Identifier _ "=" _ Expression)* (_ ",")? {
        return [ {identifier: id, expression: e}, ...members.map((m: any) => {
            return { identifier: m[3], expression: m[7] };
        }) ];
    }
