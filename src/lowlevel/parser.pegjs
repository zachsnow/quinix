Program
    = _ ds:DeclarationList? _ {
        return new LowLevelProgram(
            new NamespaceDeclaration(
                options?.namespace ?? LowLevelProgram.DEFAULT_NAMESPACE,
                ds|| [],
            )
        );
    }

DeclarationList
    = d:Declaration ds:(_ Declaration)* { return [ d, ...ds.map((d: any) => d[1])]; }

Declaration
    = TypeDeclaration
    / GlobalDeclaration
    / FunctionDeclaration
    / NamespaceDeclaration

NamespaceDeclaration
    = "namespace" _ i:Identifier _ "{" _ ds:DeclarationList? _ "}" {
        return new NamespaceDeclaration(i, ds || []);
    }

TypeDeclaration
    = "type" _ i:Identifier _ "=" _ t:Type _ ";" { return new TypeDeclaration(i, t).at(location(), text(), options); }

GlobalDeclaration
    = "global" _ ti:TypedIdentifier _ tail:("=" _ Expression _)? ";" {
        return new GlobalDeclaration(ti.identifier, ti.type, tail ? tail[2] : undefined).at(location(), text(), options);
    }

FunctionDeclaration
    = tags:TagList? "function" _ i:Identifier _ "(" _ args:TypedArgumentList? _ ")" _ ":" _ r:Type _ b:FunctionBody {
        return new FunctionDeclaration(i, args || [], r, tags || [], b).at(location(), text(), options);;
    }

FunctionBody
    = Block
    / ";" { return; }

TypedArgumentList
    = ti:TypedIdentifier tis:(_ "," _ TypedIdentifier)* { return [ti, ...tis.map((ti: any) => ti[3])]; }
