import {
  ConstructorType,
  FunctionType,
  GenericType,
  InstanceType,
  Modifier,
  PrimitiveType,
  PrimitiveTypeName,
  StructType,
  TopType,
  TopTypeName,
  Type,
  UnionType
} from "../model/types";

const PrimitiveNames = new Set<PrimitiveTypeName>(Object.values(PrimitiveTypeName));

const TopTypeNames = new Map<string, TopTypeName>([
  ["any", TopTypeName.Any],
  ["unknown", TopTypeName.Unknown]
]);

type TypePrefixParseResult = {
  type: Type;
  endPos: number;
  paramOpt: boolean;
  paramRest: boolean;
};

const isPrimitiveTypeName = (value: string): value is PrimitiveTypeName =>
  PrimitiveNames.has(value as PrimitiveTypeName);

/**
 * A parser for type expressions.
 */
class Parser {
  input: string;
  private pos: number;

  constructor(input: string, pos = 0) {
    this.input = input;
    this.pos = pos;
  }

  /**
   * Skips whitespace characters (including * for JSDoc continuation).
   */
  skipWhitespace(): void {
    for (; this.pos < this.input.length; ++this.pos) {
      const ch = this.input.charCodeAt(this.pos);
      if (ch != 32 && ch != 9 && ch != 10 && ch != 13 && ch != 42)
        break;
    }
  }

  /**
   * Skips whitespace and expects a specific character.
   */
  expectChar(ch: number): void {
    this.skipWhitespace();
    if (this.input.charCodeAt(this.pos) != ch)
      throw `Expected '${String.fromCharCode(ch)}' at position ${this.pos}`;
    this.pos++;
  }

  /**
   * Skips whitespace and expects either of two specific characters.
   * Returns whether the second character was found.
   */
  expectEitherChar(ch1: number, ch2: number): boolean {
    this.skipWhitespace();
    const current = this.input.charCodeAt(this.pos);
    if (current != ch1 && current != ch2)
      throw `Expected '${String.fromCharCode(ch1)}' or '${String.fromCharCode(ch2)}' at position ${this.pos}`;
    this.pos++;
    return current == ch2;
  }

  /**
   * Skips whitespace and expects a specific string.
   */
  expect(value: string): void {
    this.skipWhitespace();
    if (this.input.slice(this.pos, this.pos + value.length) != value)
      throw `Expected '${value}' at position ${this.pos}`;
    this.pos += value.length;
  }

  test(value: string): boolean {
    this.skipWhitespace();
    if (this.input.slice(this.pos, this.pos + value.length) == value) {
      this.pos += value.length;
      return true;
    }
    return false;
  }

  /**
   * Skips whitespace and consumes a character if present.
   */
  testChar(ch: number): boolean {
    this.skipWhitespace();
    if (this.input.charCodeAt(this.pos) == ch) {
      this.pos++;
      return true;
    }
    return false;
  }

  /**
   * Reads an identifier.
   */
  parseIdentifier(): string {
    this.skipWhitespace();
    let i = this.pos;
    for (; i < this.input.length; ++i) {
      const ch = this.input.charCodeAt(i);
      if (!((ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122) ||
        ch > 127 ||
        (ch >= 48 && ch <= 57) || ch == 95 || ch == 36 || ch == 46))
        break;
    }
    if (i == this.pos)
      throw `Expected identifier at position ${this.pos}`;
    return this.input.slice(this.pos, this.pos = i);
  }

  /**
   * Detects whether the upcoming paren group is a function type.
   */
  detectFunctionType(): boolean {
    let i = this.pos + 1;
    for (let parenLevel = 1; i < this.input.length; ++i) {
      const ch = this.input.charCodeAt(i);
      if (ch == 40)
        parenLevel++;
      else if (ch == 41 && --parenLevel == 0)
        break;
    }
    for (; ++i < this.input.length;) {
      const ch = this.input.charCodeAt(i);
      if (ch != 32 && ch != 9 && ch != 10 && ch != 13)
        break;
    }
    return this.input.slice(i, i + 2) == "=>";
  }

  /**
   * Parses a constructor type expression.
   */
  parseConstructorType(): ConstructorType | null {
    if (!this.test("new"))
      return null;
    const type = this.parseFunctionType();
    return new ConstructorType(
      type.returnType,
      null,
      null,
      type.params,
      type.paramNames,
      type.rest,
      type.optionalAfter
    );
  }

  /**
   * Parses a function type expression.
   */
  parseFunctionType(): FunctionType {
    const params: Type[] = [];
    const paramNames: string[] = [];
    let optionalAfter = Number.POSITIVE_INFINITY;
    let rest = false;
    let thisType: Type | undefined;

    this.expectChar("(".charCodeAt(0));
    if (!this.testChar(")".charCodeAt(0))) {
      for (; ;) {
        if (rest)
          throw `Rest parameter must be the last parameter at position ${this.pos}`;

        const isRest = this.test("...");
        const paramName = this.parseIdentifier();
        let isOptional = this.testChar("?".charCodeAt(0));
        this.expectChar(":".charCodeAt(0));
        let paramType = this.parseType();
        isOptional ||= this.testChar("=".charCodeAt(0));

        if (isRest) {
          rest = true;
          if (paramType instanceof GenericType && paramType.name == "Array") {
            const elementType = paramType.params[0];
            if (elementType)
              paramType = elementType;
          }
        }

        if (isOptional) {
          paramType.modifiers |= Modifier.Optional;
          if (params.length < optionalAfter)
            optionalAfter = params.length;
        }

        if (paramName == "this") {
          thisType = paramType;
          if (params.length != 0)
            throw `'this' parameter must be the first parameter at position ${this.pos}`;
        } else {
          params.push(paramType);
          paramNames.push(paramName);
        }

        if (this.expectEitherChar(",".charCodeAt(0), ")".charCodeAt(0)))
          break;
      }
    }

    this.expect("=>");
    const returnType = this.parseType();
    if (!Number.isFinite(optionalAfter))
      optionalAfter = params.length;

    return new FunctionType(params, paramNames, returnType, rest, optionalAfter, thisType);
  }

  /**
   * Parses a struct/object type.
   */
  parseStructType(): StructType {
    const members: Record<string, Type> = {};
    this.expectChar("{".charCodeAt(0));
    for (; ;) {
      if (this.testChar("}".charCodeAt(0)))
        break;

      const propName = this.parseIdentifier();
      let isOptional = propName.endsWith("$") || this.testChar("?".charCodeAt(0));
      this.expectChar(":".charCodeAt(0));
      const propType = this.parseType();
      isOptional ||= this.testChar("=".charCodeAt(0));

      if (isOptional)
        propType.modifiers |= Modifier.Optional;
      members[propName] = propType;

      if (this.expectEitherChar(",".charCodeAt(0), "}".charCodeAt(0)))
        break;
    }
    return new StructType(members);
  }

  parseNamedType(): Type {
    const name = this.parseIdentifier();
    const topTypeName = TopTypeNames.get(name);
    if (topTypeName)
      return new TopType(topTypeName);

    const primitiveName = name == "void" ? PrimitiveTypeName.Undefined : name;
    if (isPrimitiveTypeName(primitiveName))
      return new PrimitiveType(primitiveName);

    const params = this.parseTypeParams();
    if (params)
      return new GenericType(name, params);
    return new InstanceType(name);
  }

  /**
   * Parses a type expression.
   */
  parseType(): Type {
    const union = new UnionType();
    for (; ;) {
      const isNullable = this.testChar("?".charCodeAt(0));
      let isNextArrayReadonly = this.test("readonly");
      if (isNextArrayReadonly)
        this.skipWhitespace();

      if (this.pos >= this.input.length)
        break;

      let type: Type;
      const current = this.input.charCodeAt(this.pos);
      if (current == "(".charCodeAt(0)) {
        if (this.detectFunctionType()) {
          type = this.parseFunctionType();
        } else {
          this.pos++;
          type = this.parseType();
          this.expectChar(")".charCodeAt(0));
        }
      } else if (current == "{".charCodeAt(0)) {
        type = this.parseStructType();
      } else if (current == "n".charCodeAt(0)) {
        type = this.parseConstructorType() ?? this.parseNamedType();
      } else {
        type = this.parseNamedType();
      }

      while (this.testChar("[".charCodeAt(0))) {
        this.expectChar("]".charCodeAt(0));
        type = new GenericType(isNextArrayReadonly ? "ReadonlyArray" : "Array", [type]);
        isNextArrayReadonly = false;
      }

      if (isNullable || this.testChar("?".charCodeAt(0)))
        type.modifiers |= Modifier.Nullable;

      type.addToUnion(union);
      if (!this.testChar("|".charCodeAt(0)))
        break;
    }

    if (union.typeMap.size == 1) {
      const type = union.types[0];
      if (type) {
        type.modifiers |= union.modifiers;
        return type;
      }
    } else if (union.typeMap.size == 0) {
      return new PrimitiveType(
        union.isNullable() ? PrimitiveTypeName.Null : PrimitiveTypeName.Undefined
      );
    }

    return union;
  }

  /**
   * Parses type parameters.
   */
  parseTypeParams(): Type[] | null {
    const params: Type[] = [];
    if (!this.testChar("<".charCodeAt(0)))
      return null;
    for (; ;) {
      params.push(this.parseType());
      if (this.expectEitherChar(",".charCodeAt(0), ">".charCodeAt(0)))
        break;
    }
    return params;
  }

  /**
   * Gets the current position in the input.
   */
  getPosition(): number {
    return this.pos;
  }
}

/**
 * Parses a type expression and returns both the parsed type and the position
 * where parsing ended.
 */
const parseTypePrefix = (input: string, startPos = 0): TypePrefixParseResult => {
  const parser = new Parser(input, startPos);
  const paramRest = parser.test("...");
  const type = parser.parseType();
  const paramOpt = parser.testChar("=".charCodeAt(0));
  if (paramOpt)
    type.modifiers |= Modifier.Optional;
  parser.skipWhitespace();
  const endPos = parser.getPosition();
  return { type, endPos, paramOpt, paramRest };
};

/**
 * Parses a type expression and returns only the parsed type.
 */
const parseType = (input: string): Type => new Parser(input).parseType();

export {
  Parser,
  parseTypePrefix,
  parseType
};
