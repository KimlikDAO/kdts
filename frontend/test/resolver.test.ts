import { expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { combine } from "../../util/paths";
import { createBuildTempDir } from "../../util/testing/temp";
import { resolvePath } from "../resolver";

const writePackage = (dir: string, typesPath: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(combine(dir, "package.json"), JSON.stringify({
    name: "demo",
    types: `./${typesPath}`
  }, null, 2) + "\n");
  writeFileSync(combine(dir, typesPath), "export type Demo = true;\n");
};

test("package shims resolve from local @types before bundled shims and node_modules", () => {
  const cwd = process.cwd();
  const dir = createBuildTempDir("resolver");

  try {
    process.chdir(dir);

    const localPath = combine("@types", "demo");
    const bundledPath = combine("node_modules/@kimlikdao/kdts/@types", "demo");
    const dependencyPath = combine("node_modules", "demo");

    writePackage(localPath, "local.d.ts");
    writePackage(bundledPath, "bundled.d.ts");
    writePackage(dependencyPath, "dependency.d.ts");

    expect(resolvePath("src/entry.ts", "demo")).toEqual({
      path: "./" + combine(localPath, "local.d.ts"),
      id: "package:demo"
    });

    rmSync(localPath, { force: true, recursive: true });
    expect(resolvePath("src/entry.ts", "demo")).toEqual({
      path: combine(bundledPath, "bundled.d.ts"),
      id: "package:demo"
    });

    rmSync(bundledPath, { force: true, recursive: true });
    expect(resolvePath("src/entry.ts", "demo")).toEqual({
      path: combine(dependencyPath, "dependency.d.ts"),
      id: "package:demo"
    });
  } finally {
    process.chdir(cwd);
    rmSync(dir, { force: true, recursive: true });
  }
});
