import { chmodSync, copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const isLocal = process.argv.includes("--local");

const BuildDir = "build";
const RootFiles = ["package.json", "kdts.d.ts", "bench.ts", "README.md"];
const ScriptFiles = ["scripts/build.ts", "scripts/postinstall.ts"];
const UtilFiles = [
  "util/assert.ts",
  "util/arrays.ts",
  "util/cli.ts",
  "util/paths.ts",
  "util/promises.ts"
];

const copyToBuild = (path: string) => {
  mkdirSync(join(BuildDir, dirname(path)), { recursive: true });
  copyFileSync(path, join(BuildDir, path));
};

rmSync(BuildDir, { recursive: true, force: true });
mkdirSync(join(BuildDir, "util"), { recursive: true });
cpSync("@types", join(BuildDir, "@types"), { recursive: true });

for (const path of RootFiles)
  copyToBuild(path);
for (const path of ScriptFiles)
  copyToBuild(path);
for (const path of UtilFiles)
  copyToBuild(path);

const command = [
  process.execPath,
  "kdts.ts",
  "kdts.ts",
  "--fast",
  "-o",
  join(BuildDir, "kdts.js"),
];
if (!isLocal)
  command.push("--override", "Source=npm");

const build = Bun.spawnSync(command, { stdio: ["inherit", "inherit", "inherit"] });
if (build.exitCode)
  process.exit(build.exitCode);

chmodSync(join(BuildDir, "kdts.js"), 0o755);
