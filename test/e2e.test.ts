import { expect, test } from "bun:test";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { combine, replaceExt } from "../kdts/util/paths";
import { compile } from "../kdts/compiler";

test("compile API exports e2e", async () => {
  mkdirSync("build", { recursive: true });
  const exportsEntry = "build/exports.ts";
  const exportsOutput = "build/exports.out.js";
  writeFileSync(exportsEntry, "export default 7;\nexport const answer = 42;\n");

  const code = await compile({
    target: [exportsEntry],
    output: exportsOutput,
    strict: true,
  });
  if (typeof code != "string")
    throw new Error(`Expected compile() to return code for ${exportsEntry}`);
  const writtenCode = readFileSync(exportsOutput, "utf8");

  expect(code).not.toContain("__kdts_export__");
  expect(code).not.toContain("kdts_exports");
  expect(writtenCode).not.toContain("__kdts_export__");

  const mod = await import("../" + exportsOutput);
  expect(mod.default).toBe(7);
  expect(mod.answer).toBe(42);
});

test("compile API e2e", async () => {
  const showcaseDir = "showcase";
  const showcaseEntries = readdirSync(showcaseDir)
    .filter((fileName) => fileName.endsWith(".ts") && !fileName.endsWith(".d.ts"))
    .sort();

  for (const fileName of showcaseEntries) {
    const entry = combine(showcaseDir, fileName);
    const output = combine("build", replaceExt(fileName, ".out.js"));
    const code = await compile({ target: [entry], output });
    if (typeof code != "string")
      throw new Error(`Expected compile() to return code for ${fileName}`);
    expect(code).toBe(readFileSync(output, "utf8"));
  }
}, { timeout: 20_000 });
