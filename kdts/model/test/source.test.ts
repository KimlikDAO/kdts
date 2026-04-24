import { expect, test } from "bun:test";
import { removeOrigin } from "../source";

test("removeOrigin strips package and module prefixes", () => {
  expect(removeOrigin("package:@kimlikdao/kdts")).toBe("@kimlikdao/kdts");
  expect(removeOrigin("module:build/tmp/entry.ts")).toBe("build/tmp/entry.ts");
});

test("removeOrigin leaves global unchanged", () => {
  expect(removeOrigin("global")).toBe("global");
});
