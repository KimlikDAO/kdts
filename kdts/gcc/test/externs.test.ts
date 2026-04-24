import { test } from "bun:test";
import { expect } from "bun:test";
import { SourceSet } from "../../frontend/sourceSet";
import { harness } from "../../util/testing/harness";
import { stripIndent } from "../../util/testing/source";
import { transpileDts } from "../transpile";

const expectEmit = harness(transpileDts);

test("externs serialize type-only imports as alias imports", () => {
  const out = transpileDts(
    { id: "module:kdts/test.d", path: "/kdts/test.d.ts" },
    `
    import { LargeConstant as Marker } from "./kdts.d.ts";
  `,
    new SourceSet()
  );
  expect(out).toBe(stripIndent(`
    /** @fileoverview @externs */
    /** @const */
    const Marker = kdts$$module$kdts$kdts_d$LargeConstant;

  `));
});

test("externs lower default exports into aliased const declarations", () => {
  expectEmit(`
    declare var process: string;

    export default process;
  `, `
    /** @fileoverview @externs */
    /** @type {string} */
    let kdts$$module$test_d$process;
    /** @const */
    const kdts$$module$test_d$default = kdts$$module$test_d$process;
  `);
});
