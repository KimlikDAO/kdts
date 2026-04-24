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
  getNativeCompilerFile,
  getNativeCompilerPackage,
  getNativeCompilerPackageName,
  NativeCompilerPackage,
  NativeCompilerPackages
} from "../kdts/gcc/nativePackages";
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
  author?: string;
  bugs?: unknown;
  homepage?: string;
  license?: string;
  repository?: unknown;
  version: string;
  cpu: string[];
  description?: string;
  files: string[];
  name: string;
  os: string[];
};

const BuildDir = "build";
const SourceDir = "kdts";
const RootBuildDir = join(BuildDir, "kdts");
const RootFiles = [
  ["kdts/kdts.d.ts", "kdts.d.ts"],
  ["kdts/bench.ts", "bench.ts"],
  ["README.md", "README.md"],
] as const;
const UtilFiles = [
  ["kdts/util/assert.ts", "util/assert.ts"],
  ["kdts/util/arrays.ts", "util/arrays.ts"],
] as const;

const args = process.argv.slice(2);
const isLocal = args.includes("--local");
const buildCompilerOnly = args.includes("--compiler-only");
const buildNativeOnly = args.includes("--native-only");
const buildNative = buildNativeOnly || args.includes("--native");
const compilerJarArgIndex = args.indexOf("--compiler-jar");
const providedCompilerJar = compilerJarArgIndex == -1
  ? ""
  : args[compilerJarArgIndex + 1] || "";

const copyToDir = (
  baseDir: string,
  sourcePath: string,
  targetPath = sourcePath,
) => {
  mkdirSync(join(baseDir, dirname(targetPath)), { recursive: true });
  copyFileSync(sourcePath, join(baseDir, targetPath));
};

const readRootPackageJson = (): RootPackageJson =>
  JSON.parse(readFileSync("package.json", "utf8")) as RootPackageJson;

const sanitizeRootPackageJson = (
  packageJson: RootPackageJson,
): RootPackageJson => {
  const sanitized = structuredClone(packageJson);
  delete sanitized.devDependencies;
  delete sanitized.scripts;
  if (sanitized.kdts)
    sanitized.kdts["sources"] = ".";
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

const makeNativePackageJson = (
  rootPackageJson: RootPackageJson,
  nativePackage: NativeCompilerPackage,
): NativePackageJson => ({
  author: rootPackageJson.author,
  bugs: rootPackageJson.bugs,
  cpu: [nativePackage.arch],
  description: `Native ${nativePackage.displayName} build of @kimlikdao/gcc`,
  files: [getNativeCompilerFile(nativePackage)],
  homepage: rootPackageJson.homepage,
  license: rootPackageJson.license,
  name: getNativeCompilerPackageName(nativePackage),
  os: [nativePackage.platform],
  repository: rootPackageJson.repository,
  version: rootPackageJson.version,
});

const buildRootPackage = (
  packageJson: RootPackageJson,
  compilerJarPath: string,
) => {
  rmSync(RootBuildDir, { recursive: true, force: true });
  mkdirSync(join(RootBuildDir, "util"), { recursive: true });
  cpSync(join(SourceDir, "@types"), join(RootBuildDir, "@types"), { recursive: true });
  writeBuildPackageJson(
    join(RootBuildDir, "package.json"),
    sanitizeRootPackageJson(packageJson),
  );
  for (const [sourcePath, targetPath] of RootFiles)
    copyToDir(RootBuildDir, sourcePath, targetPath);
  for (const [sourcePath, targetPath] of UtilFiles)
    copyToDir(RootBuildDir, sourcePath, targetPath);
  copyFileSync(compilerJarPath, join(RootBuildDir, "compiler.jar"));

  const command = [
    process.execPath,
    join(SourceDir, "kdts.ts"),
    join(SourceDir, "kdts.ts"),
    "--fast",
    "-o",
    join(RootBuildDir, "kdts.js"),
  ];
  if (!isLocal)
    command.push("--override", "Source=npm");
  run(command);
  chmodSync(join(RootBuildDir, "kdts.js"), 0o755);
};

const writeNativePackageJson = (
  rootPackageJson: RootPackageJson,
  nativePackage: NativeCompilerPackage,
) => {
  writeBuildPackageJson(
    join(getNativeCompilerBuildDir(nativePackage), "package.json"),
    makeNativePackageJson(rootPackageJson, nativePackage),
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
  try {
    buildNativeCompiler(nativePackage, resolve(buildDir));
  } finally {
    rmSync(nativeCompilerJar, { force: true });
  }
};

const rootPackageJson = readRootPackageJson();
const compilerJarPath = ensureCompilerJar(rootPackageJson.version, providedCompilerJar);

if (buildCompilerOnly)
  process.exit(0);

if (!buildNativeOnly)
  buildRootPackage(rootPackageJson, compilerJarPath);

if (buildNative)
  buildCurrentNativePackage(rootPackageJson, compilerJarPath);
