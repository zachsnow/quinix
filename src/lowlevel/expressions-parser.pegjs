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
    / NullToken { return new NullExpression().at(location(), text(), options); }
    / SizeofToken _ t:Type { return new SizeofExpression(t).at(location(), text(), options); }
    / id:QualifiedIdentifier _ typeArgs:TypeArgumentList? {
        return new IdentifierExpression(id, typeArgs || []).at(location(), text(), options);
    }

ExpressionList
    = e:Expression es:(_ "," _ Expression)* (_ ",")? { return [e, ...es.map((e: any) => e[3])]; }

PostfixExpression
    = e:PrimaryExpression tail:(PostfixExpressionSuffix)* { return SuffixExpression.build(e, tail).at(location(), text(), options); }

PostfixExpressionSuffix
    = _ "[" _ u:UnsafeToken? _ e:Expression _ "]" { return SuffixExpression.createIndex(e, !!u, location(), text(), options); }
    / _ "." _ id:Identifier { return SuffixExpression.createMember(id, false, location(), text(), options); }
    / _ "->" _ id:Identifier { return SuffixExpression.createMember(id, true, location(), text(), options); }
    / _ "(" _ args:ExpressionList? _ ")" { return SuffixExpression.createCall(args || [], location(), text(), options); }

PrefixExpression
    = op:UnaryOperator _ e:PrefixExpression { return new UnaryExpression(op, e).at(location(), text(), options); }
    / "<" _ u:UnsafeToken? _ t:Type _ ">" _ e:PrefixExpression { return new CastExpression(t, e, !!u).at(location(), text(), options); }
    / NewArrayExpression
    / NewExpression
    / PostfixExpression

NewArrayExpression
    // Initializer and ellipsis expressions.
    = NewToken _ t:Type _ "[" _ s:Expression _ "]" _ el:("="/"...") _ e:Expression {
        return new NewArrayExpression(
            new ArrayType(t).at(t.location), s, e, el === "..."
        ).at(location(), text(), options);
    }

    // Zero.
    / NewToken _ t:Type _ "[" _ s:Expression _ "]" {
        return new NewArrayExpression(
            new ArrayType(t).at(t.location), s, undefined, false
        ).at(location(), text(), options);
    }

    // Special case initializers.
    // new byte[] = 'foo' => new byte[3] = 'foo'; new byte[] = [ 1,2,3 ] = new byte[3] = [ 1,2,3 ]
    / NewToken _ t:Type _ "=" _ e:(StringExpression/ArrayExpression) {
        return new NewArrayExpression(t, new IntLiteralExpression(e.length), e, false).at(location(), text(), options);
    }


NewExpression
    // Initializer expressions.
    = NewToken _ t:Type _ el:("="/"...") _ e:Expression { return new NewExpression(t, e, el === "...").at(location(), text(), options); }

    // Zero.
    / NewToken _ t:Type { return new NewExpression(t).at(location(), text(), options); }

UnaryOperator
    = "*"
    / "+"
    / "-"
    / "!"
    / "&"
    / "!"
    / LenToken
    / CapacityToken

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

TypeArgumentList
    = "<" _ ts:TypeList _ ">" { return ts; }
