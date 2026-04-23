import { Node } from "acorn";
import { expect, test } from "bun:test";
import { Modifier } from "../../model/modifier";
import { modifiersFromJsDoc } from "../jsdocParser";
import { parseSource } from "./utils";

type NodeWithModifiers<TNode extends Node> = TNode & { modifiers?: Modifier };

function expectNodeType<
  TNode extends { type: string } | null | undefined,
  TType extends NonNullable<TNode>["type"]
>(
  node: TNode,
  type: TType
): asserts node is Extract<NonNullable<TNode>, { type: TType }> {
  expect(node?.type).toBe(type);
}

function withModifiers<TNode extends Node>(node: TNode): NodeWithModifiers<TNode> {
  return node as NodeWithModifiers<TNode>;
}

test("modifier from JSDoc attaches to statement-level VariableDeclaration, not nested one", () => {
  const ast = parseSource(`
    /** @satisfies {PureFn} */
    const triple = (x: bigint): bigint => {
      /** @satisfies {PureFn} */
      const double = (x: bigint): bigint => x + x;
      const xx = double(x);
      return xx + x;
    };
  `);
  const stmt = ast.body[0];
  expectNodeType(stmt, "VariableDeclaration");
  expectNodeType(stmt.declarations[0].id, "Identifier");
  expect(stmt.declarations[0].id.name).toBe("triple");
  expect(withModifiers(stmt).modifiers).toBe(Modifier.Pure);
  expectNodeType(stmt.declarations[0].init, "ArrowFunctionExpression");
  expectNodeType(stmt.declarations[0].init.body, "BlockStatement");
  const innerBlock = stmt.declarations[0].init.body.body;
  const doubleDecl = innerBlock[0];
  expectNodeType(doubleDecl, "VariableDeclaration");
  expectNodeType(doubleDecl.declarations[0].id, "Identifier");
  expect(doubleDecl.declarations[0].id.name).toBe("double");
  expect(withModifiers(doubleDecl).modifiers).toBe(Modifier.Pure);
});

test("Function modifiers attach on ArrowFunctionExpressions", () => {
  const ast = parseSource(`
    f(P, /** @satisfies {PureFn} */ () => {});
  `);
  const stmt = ast.body[0];
  expectNodeType(stmt, "ExpressionStatement");
  const call = stmt.expression;
  expectNodeType(call, "CallExpression");
  const innerFn = call.arguments[1];
  expectNodeType(innerFn, "ArrowFunctionExpression");
  expect(withModifiers(innerFn).modifiers).toBe(Modifier.Pure);
});

test("modifiersFromJsDoc ORs @satisfies entries and ignores unknown modifiers", () => {
  const modifiers = modifiersFromJsDoc(`
    * @satisfies {DeterministicFn & InlineFn & UnknownFn}
    * @satisfies {InlineFriendlyFn}
  `);

  expect(modifiers).toBe(
    Modifier.Deterministic | Modifier.Inline | Modifier.InlineFriendly
  );
});

test("Inline modifiers attach on FunctionDeclarations", () => {
  const ast = parseSource(`
    /** @satisfies {InlineFn} */
    function arr<T>(x: T[] | T): T[] {
      return Array.isArray(x) ? x : [x];
    }
  `);
  const stmt = ast.body[0];
  expectNodeType(stmt, "FunctionDeclaration");
  expect(stmt.id.name).toBe("arr");
  expect(withModifiers(stmt).modifiers).toBe(Modifier.Inline);
});

test("multiple @satisfies tags accumulate on the parsed node", () => {
  const ast = parseSource(`
    /**
     * @satisfies {DeterministicFn & InlineFn}
     * @satisfies {InlineFriendlyFn & UnknownFn}
     */
    const run = () => 1;
  `);
  const stmt = ast.body[0];
  expectNodeType(stmt, "VariableDeclaration");
  expect(withModifiers(stmt).modifiers).toBe(
    Modifier.Deterministic | Modifier.Inline | Modifier.InlineFriendly
  );
});

test("Function modifiers attach on parenthesized destructuring ArrowFunctionExpressions", () => {
  const ast = parseSource(`
    f(
      /** @satisfies {PureFn} */
      ({ x, yParity }: CompressedPoint): Point | null => {}
    );
  `);
  const stmt = ast.body[0];
  expectNodeType(stmt, "ExpressionStatement");
  const call = stmt.expression;
  expectNodeType(call, "CallExpression");
  const innerFn = call.arguments[0];
  expectNodeType(innerFn, "ArrowFunctionExpression");
  expect(withModifiers(innerFn).modifiers).toBe(Modifier.Pure);
  expectNodeType(innerFn.params[0], "ObjectPattern");
  expect(withModifiers(innerFn.params[0]).modifiers).toBeUndefined();
});
