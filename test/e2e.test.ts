import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { combine, replaceExt } from "../util/paths";
import { compile } from "../compiler";
import { compileEntry } from "../util/testing/e2e";

const SelfPackageDir = "node_modules/@kimlikdao/kdts";
let createdSelfPackage = false;

beforeAll(() => {
  if (existsSync(SelfPackageDir))
    return;

  mkdirSync(SelfPackageDir, { recursive: true });
  writeFileSync(combine(SelfPackageDir, "package.json"), JSON.stringify({
    name: "@kimlikdao/kdts",
    types: "./kdts.d.ts"
  }, null, 2) + "\n");
  symlinkSync("../../../kdts.d.ts", combine(SelfPackageDir, "kdts.d.ts"));
  symlinkSync("../../../@types", combine(SelfPackageDir, "@types"));
  createdSelfPackage = true;
});

afterAll(() => {
  if (!createdSelfPackage)
    return;
  rmSync(SelfPackageDir, { force: true, recursive: true });
});

test("compile API compiles a.ts and emitted output runs", async () => {
  const entry = "showcase/dogCage.ts";
  const compiled = await compileEntry(entry);

  try {
    expect(compiled.code).toBe(compiled.writtenCode);
    expect(compiled.code).toContain("\"doggy\"");

    const result = await compiled.run();
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim()).toBe("doggy");
  } finally {
    compiled.cleanup();
  }
});

test("compile API restores exported entry bindings as esm exports", async () => {
  mkdirSync("build", { recursive: true });
  const entry = "build/exports.ts";
  const output = "build/exports.out.js";
  writeFileSync(entry, "export default 7;\nexport const answer = 42;\n");

  const code = await compile({ target: [entry], output, strict: true });
  if (typeof code != "string")
    throw new Error(`Expected compile() to return code for ${entry}`);
  const writtenCode = readFileSync(output, "utf8");

  expect(code).not.toContain("__kdts_export__");
  expect(code).not.toContain("kdts_exports");
  expect(writtenCode).not.toContain("__kdts_export__");

  const mod = await import("../build/exports.out.js");
  expect(mod.default).toBe(7);
  expect(mod.answer).toBe(42);
});

test("compile API builds every showcase file", async () => {
  mkdirSync("build", { recursive: true });
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
}, { timeout: 15_000 });
