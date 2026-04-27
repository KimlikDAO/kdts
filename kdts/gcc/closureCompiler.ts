import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DiskProgram } from "../model/program";
import {
  getNativeCompilerFile,
  getNativeCompilerPackage,
  getNativeCompilerPackageName,
} from "./nativePackages";

const JavaRuntimeArgs = [
  "-XX:+IgnoreUnrecognizedVMOptions",
  "--sun-misc-unsafe-memory-access=allow",
];

type Executable = {
  cmd: string[];
  platform: "native" | "java";
  source: "kdts-package";
};

const findFile = (...paths: (string | null)[]): string | null =>
  paths.find((path): path is string => !!path && existsSync(path)) || null;

const findRuntimePackage = (path: string): string | null => {
  try {
    return fileURLToPath(import.meta.resolve(path));
  } catch {
    return null;
  }
};

const fromModule = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

const getJavaCommand = (javaJarPath: string): string[] =>
  ["java", ...JavaRuntimeArgs, "-jar", javaJarPath];

const getNativeExecutable = (
  platform = process.platform,
  arch = process.arch,
): Executable | null => {
  const nativePackage = getNativeCompilerPackage(platform, arch);
  if (!nativePackage)
    return null;

  const compilerFile = getNativeCompilerFile(nativePackage);
  const kdtsNativeImage = findRuntimePackage(
    `${getNativeCompilerPackageName(nativePackage)}/${compilerFile}`,
  );
  if (kdtsNativeImage)
    return {
      cmd: [kdtsNativeImage],
      platform: "native",
      source: "kdts-package",
    };
  return null;
};

const getJavaExecutable = (): Executable => {
  const kdtsJavaJarPath = findFile(fromModule("./compiler.jar"));
  if (kdtsJavaJarPath)
    return {
      cmd: getJavaCommand(kdtsJavaJarPath),
      platform: "java",
      source: "kdts-package",
    };

  const installedJavaJarPath = findRuntimePackage(
    "@kimlikdao/kdts/compiler.jar",
  );
  if (installedJavaJarPath)
    return {
      cmd: getJavaCommand(installedJavaJarPath),
      platform: "java",
      source: "kdts-package",
    };
  throw new Error(
    "No @kimlikdao/kdts compiler.jar found. Build and stage kdts, or install a published @kimlikdao/kdts package.",
  );
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
  const { cmd, platform, source } = createClosureCompilerCommand(program, params);
  console.info(
    "GCC isolate:   ",
    program.isolateDir,
    `(for ${program.entry})`
  );
  console.info(`GCC platform:   ${platform} (${source})`);

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
