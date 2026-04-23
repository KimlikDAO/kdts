import {
  chmodSync,
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  getNativeCompilerBuildDir,
  getNativeCompilerPackage,
  getNativeCompilerPackageDir,
  getNativeCompilerPackageName,
  NativeCompilerPackages,
  NativeCompilerPackage
} from "../gcc/nativePackages";
import { ensureCompilerJar } from "./buildCompiler";
import { buildNativeCompiler } from "./graal";
import { run } from "./run";

type RootPackageJson = {
  author?: string;
  bin?: Record<string, string>;
  bugs?: unknown;
  dependencies?: Record<string, string>;
  description?: string;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  homepage?: string;
  kdts?: Record<string, unknown>;
  keywords?: string[];
  license?: string;
  name: string;
  optionalDependencies?: Record<string, string>;
  repository?: unknown;
  scripts?: Record<string, string>;
  type?: string;
  types?: string;
  version: string;
};

type NativePackageJson = {
  cpu: string[];
  description?: string;
  files: string[];
  name: string;
  os: string[];
  preferUnplugged?: boolean;
};

const BuildDir = "build";
const RootBuildDir = join(BuildDir, "kdts");
const RootFiles = ["kdts.d.ts", "bench.ts", "README.md"];
const UtilFiles = ["util/assert.ts", "util/arrays.ts", "util/cli.ts"];

const args = process.argv.slice(2);
const isLocal = args.includes("--local");
const buildCompilerOnly = args.includes("--compiler-only");
const buildNativeOnly = args.includes("--native-only");
const buildNative = buildNativeOnly || args.includes("--native");
const compilerJarArgIndex = args.indexOf("--compiler-jar");
const providedCompilerJar = compilerJarArgIndex == -1
  ? ""
  : args[compilerJarArgIndex + 1] || "";

const copyToDir = (baseDir: string, path: string) => {
  mkdirSync(join(baseDir, dirname(path)), { recursive: true });
  copyFileSync(path, join(baseDir, path));
};

const readRootPackageJson = (): RootPackageJson =>
  JSON.parse(readFileSync("package.json", "utf8")) as RootPackageJson;

const sanitizeRootPackageJson = (
  packageJson: RootPackageJson,
): RootPackageJson => {
  const sanitized = structuredClone(packageJson);
  delete sanitized.devDependencies;
  delete sanitized.scripts;
  if (sanitized.dependencies) {
    delete sanitized.dependencies["google-closure-compiler"];
    if (!Object.keys(sanitized.dependencies).length)
      delete sanitized.dependencies;
  }
  sanitized.optionalDependencies = Object.fromEntries(
    NativeCompilerPackages.map((pkg) => [
      getNativeCompilerPackageName(pkg),
      sanitized.version
    ]),
  );
  return sanitized;
};

const writeBuildPackageJson = (
  path: string,
  packageJson: RootPackageJson | NativePackageJson,
) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(packageJson, null, 2) + "\n");
};

const buildRootPackage = (
  packageJson: RootPackageJson,
  compilerJarPath: string,
) => {
  rmSync(RootBuildDir, { recursive: true, force: true });
  mkdirSync(join(RootBuildDir, "util"), { recursive: true });
  cpSync("@types", join(RootBuildDir, "@types"), { recursive: true });
  writeBuildPackageJson(
    join(RootBuildDir, "package.json"),
    sanitizeRootPackageJson(packageJson),
  );
  for (const path of RootFiles)
    copyToDir(RootBuildDir, path);
  for (const path of UtilFiles)
    copyToDir(RootBuildDir, path);
  copyFileSync(compilerJarPath, join(RootBuildDir, "compiler.jar"));

  const command = [
    process.execPath,
    "kdts.ts",
    "kdts.ts",
    "--fast",
    "-o",
    join(RootBuildDir, "kdts.js"),
  ];
  if (!isLocal)
    command.push("--override", "Source=npm");
  run(command);
  chmodSync(join(RootBuildDir, "kdts.js"), 0o755);
};

const readNativePackageJson = (
  nativePackage: NativeCompilerPackage,
): NativePackageJson =>
  JSON.parse(readFileSync(join(getNativeCompilerPackageDir(nativePackage), "package.json"), "utf8")) as NativePackageJson;

const writeNativePackageJson = (
  rootPackageJson: RootPackageJson,
  nativePackage: NativeCompilerPackage,
) => {
  const packageJson = readNativePackageJson(nativePackage);
  const buildPackageJson = {
    ...packageJson,
    author: rootPackageJson.author,
    bugs: rootPackageJson.bugs,
    homepage: rootPackageJson.homepage,
    license: rootPackageJson.license,
    repository: rootPackageJson.repository,
    version: rootPackageJson.version,
  };
  writeBuildPackageJson(
    join(getNativeCompilerBuildDir(nativePackage), "package.json"),
    buildPackageJson,
  );
};

const buildCurrentNativePackage = (
  rootPackageJson: RootPackageJson,
  compilerJarPath: string,
) => {
  const nativePackage = getNativeCompilerPackage();
  if (!nativePackage)
    throw new Error(`No native package is configured for ${process.platform}-${process.arch}.`);

  const buildDir = getNativeCompilerBuildDir(nativePackage);
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  writeNativePackageJson(rootPackageJson, nativePackage);

  const nativeCompilerJar = join(buildDir, "compiler.jar");
  copyFileSync(compilerJarPath, nativeCompilerJar);
  buildNativeCompiler(nativePackage, resolve(buildDir));
  rmSync(nativeCompilerJar, { force: true });
};

const rootPackageJson = readRootPackageJson();
const compilerJarPath = ensureCompilerJar(rootPackageJson.version, providedCompilerJar);

if (buildCompilerOnly)
  process.exit(0);

if (!buildNativeOnly)
  buildRootPackage(rootPackageJson, compilerJarPath);

if (buildNative)
  buildCurrentNativePackage(rootPackageJson, compilerJarPath);
