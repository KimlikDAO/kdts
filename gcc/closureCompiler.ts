import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DiskProgram } from "../model/program";
import {
  getNativeCompilerFile,
  getNativeCompilerPackage,
  getNativeCompilerPackageName,
  getStockCompilerPackageName,
} from "./nativePackages";

const JavaRuntimeArgs = [
  "-XX:+IgnoreUnrecognizedVMOptions",
  "--sun-misc-unsafe-memory-access=allow",
];

type Executable = {
  cmd: string[];
  platform: "native" | "java";
};

const findFile = (...paths: (string | null)[]): string | null =>
  paths.find((path): path is string => !!path && existsSync(path)) || null;

const findPackage = (path: string): string | null => {
  try {
    return fileURLToPath(import.meta.resolve(path));
  } catch {
    return null;
  }
};

const fromModule = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

const getNativeExecutable = (
  platform = process.platform,
  arch = process.arch,
): Executable | null => {
  const nativePackage = getNativeCompilerPackage(platform, arch);
  if (!nativePackage)
    return null;

  const compilerFile = getNativeCompilerFile(nativePackage);
  const nativeImagePath = findPackage(
    `${getNativeCompilerPackageName(nativePackage)}/${compilerFile}`,
  ) || findPackage(
    `${getStockCompilerPackageName(nativePackage)}/${compilerFile}`,
  );
  if (!nativeImagePath)
    return null;

  return {
    cmd: [nativeImagePath],
    platform: "native",
  };
};

const getJavaExecutable = (): Executable => {
  const javaJarPath = findFile(
    fromModule("./compiler.jar"),
    fromModule("../vendor/gcc/bazel-bin/compiler_uberjar_deploy.jar"),
    findPackage("google-closure-compiler-java/compiler.jar"),
  );
  if (!javaJarPath)
    throw new Error("No Closure Compiler jar found in node_modules.");
  return {
    cmd: ["java", ...JavaRuntimeArgs, "-jar", javaJarPath],
    platform: "java",
  };
};

const createCompilerArgs = (
  program: DiskProgram,
  params: ClosureCompilerParams
): string[] => {
  const args = program.sources.slice();
  args.push(
    "--compilation_level=ADVANCED",
    "--charset=utf-8",
    "--warning_level=verbose",
    "--emit_use_strict=false",
    "--rewrite_polyfills=false",
    "--assume_function_wrapper",
    "--language_in=UNSTABLE",
    "--language_out=UNSTABLE",
    "--chunk_output_type=ES_MODULES",
    "--module_resolution=NODE",
    "--dependency_mode=PRUNE",
    "--jscomp_off=boundedGenerics",
  );

  for (const error of params.jsCompErrors)
    args.push(`--jscomp_error=${error}`);
  for (const warning of params.jsCompWarnings)
    args.push(`--jscomp_warning=${warning}`);
  if (program.entry)
    args.push(`--entry_point=${program.entry}`);

  return args;
};

const createClosureCompilerCommand = (
  program: DiskProgram,
  params: ClosureCompilerParams,
): Executable => {
  const exec = getNativeExecutable() || getJavaExecutable();
  exec.cmd.push(...createCompilerArgs(program, params));
  return exec;
};

type ClosureCompilerParams = {
  jsCompErrors: string[];
  jsCompWarnings: string[];
};

const compileWithClosureCompiler = async (
  program: DiskProgram,
  params: ClosureCompilerParams,
): Promise<string> => {
  const { cmd, platform } = createClosureCompilerCommand(program, params);
  console.info(
    "GCC isolate:   ",
    program.isolateDir,
    `(for ${program.entry})`
  );
  console.info("GCC platform:  ", platform);

  const proc = Bun.spawnSync({
    cmd,
    cwd: program.isolateDir,
    stdout: "pipe"
  });
  const output = proc.stdout.toString();
  const errors = proc.stderr.toString();
  const exitCode = proc.exitCode;

  if (exitCode || errors)
    throw `${cmd.join(" ")}\n\n${errors || exitCode}\n\n`;
  return output;
};

export {
  compileWithClosureCompiler,
  createClosureCompilerCommand,
  getJavaExecutable,
  getNativeExecutable
};
