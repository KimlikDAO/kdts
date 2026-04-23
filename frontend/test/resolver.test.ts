import { expect, test } from "bun:test";
import { resolvePath } from "../resolver";

test("local @types win when a package is also installed", () => {
  expect(resolvePath("src/entry.ts", "uglify-js")).toEqual({
    path: "./@types/uglify-js/index.d.ts",
    id: "package:uglify-js"
  });
});

test("installed packages resolve their published declarations", () => {
  expect(resolvePath("src/entry.ts", "acorn")).toEqual({
    path: "node_modules/acorn/dist/acorn.d.ts",
    id: "package:acorn"
  });
});
