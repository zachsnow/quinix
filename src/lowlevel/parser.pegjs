Program
    = _ ds:DeclarationList? _ {
        return new LowLevelProgram(
            new NamespaceDeclaration(
                LowLevelProgram.GLOBAL_NAMESPACE,
                ds|| [],
            ).at(location(), text(), options),
        );
    }

DeclarationList
    = d:Declaration ds:(_ Declaration)* { return [ d, ...ds.map((d: any) => d[1])]; }

Declaration
    = TypeDeclaration
    / GlobalDeclaration
    / FunctionDeclaration
    / NamespaceDeclaration
    / UsingDeclaration

NamespaceDeclaration
    = NamespaceToken _ id:QualifiedIdentifier _ "{" _ ds:DeclarationList? _ "}" {
        return NamespaceDeclaration.build(id, ds || [], location(), text(), options);
    }

UsingDeclaration
    = UsingToken _ id:QualifiedIdentifier ";" {
        return new UsingDeclaration(id).at(location(), text(), options);
    }

TypeDeclaration
    = tags:TagList? TypeToken _ i:Identifier _ "=" _ t:Type _ ";" {
        return new TypeDeclaration(i, t).at(location(), text(), options).tag(tags || []);
    }
    / tags:TagList? TypeToken _ i:Identifier _ tyArgs:TypeVariableList _ "=" _ t:Type _ ";" {
        return new TemplateTypeDeclaration(i, tyArgs, t).at(location(), text(), options).tag(tags || []);
    }

GlobalDeclaration
    = tags:TagList? _ GlobalToken _ ti:TypedIdentifier _ tail:("=" _ Expression _)? ";" {
        return new GlobalDeclaration(
            ti.identifier, ti.type, tail ? tail[2] : undefined
        ).at(location(), text(), options).tag(tags || []);
    }

FunctionDeclaration
    = tags:TagList? _ FunctionToken _ id:Identifier _ "(" _ args:TypedArgumentList? _ ")" _ ":" _ r:Type _ b:FunctionBody {
        return new FunctionDeclaration(
            id,
            args || [],
            r,
            b,
        ).at(location(), text(), options).tag(tags || []);
    }
    / tags:TagList? _ FunctionToken _ id:Identifier _ tyArgs:TypeVariableList _ "(" _ args:TypedArgumentList? _ ")" _ ":" _ r:Type _ b:Block {
        return new TemplateFunctionDeclaration(
            id,
            tyArgs,
            args || [],
            r,
            b,
        ).at(location(), text(), options).tag(tags || []);
    }

FunctionBody
    = Block
    / ";" { return; }



TypedArgumentList
    = ti:TypedIdentifier tis:(_ "," _ TypedIdentifier)* {
        return [ti, ...tis.map((ti: any) => ti[3])];
    }
