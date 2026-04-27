import { spawn } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DiskProgram } from "../model/program";
import { getNativePackageCompiler } from "./nativePackages";

const JavaRuntimeArgs = [
  "-XX:+IgnoreUnrecognizedVMOptions",
  "--sun-misc-unsafe-memory-access=allow",
];

type Executable = {
  cmd: string[];
  platform: "native" | "java";
  version: string;
};

type PackageFile = {
  path: string;
  version: string;
};

const getFileFromPackage = (
  packageName: string | null,
  file: string,
): PackageFile | null => {
  try {
    const packageJsonPath = packageName
      ? fileURLToPath(import.meta.resolve(`${packageName}/package.json`))
      : fileURLToPath(new URL("./package.json", import.meta.url));
    const packageFilePath = join(dirname(packageJsonPath), file);
    if (!existsSync(packageFilePath))
      return null;
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      version?: unknown;
    };
    if (typeof packageJson.version != "string" || !packageJson.version)
      throw new Error(`Missing package.json version in ${packageJsonPath}`);
    return {
      path: packageFilePath,
      version: packageJson.version,
    };
  } catch {
    return null;
  }
};

const getNativeExecutable = (
  platform = process.platform,
  arch = process.arch,
): Executable | null => {
  const native = getNativePackageCompiler(platform, arch);
  if (!native)
    return null;
  const kdtsNativeImage = getFileFromPackage(
    native.package,
    native.compiler,
  );
  return kdtsNativeImage && {
    cmd: [kdtsNativeImage.path],
    platform: "native",
    version: kdtsNativeImage.version,
  };
};

const getJavaExecutable = (): Executable => {
  const javaJar = getFileFromPackage(null, "compiler.jar")
    || getFileFromPackage("@kimlikdao/kdts", "compiler.jar");
  if (!javaJar)
    throw new Error(
      "No @kimlikdao/kdts compiler.jar found. Build and stage kdts, or install a published @kimlikdao/kdts package.",
    );
  return {
    cmd: ["java", ...JavaRuntimeArgs, "-jar", javaJar.path],
    platform: "java",
    version: javaJar.version,
  };
};

const createClosureCompilerCommand = (
  program: DiskProgram,
  params: ClosureCompilerParams,
): Executable => {
  const exec = getNativeExecutable() || getJavaExecutable();
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

  exec.cmd.push(...args);
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
  const { cmd, platform, version } = createClosureCompilerCommand(program, params);
  console.info(
    "GCC isolate:   ",
    program.isolateDir,
    `(for ${program.entry})`
  );
  console.info(`GCC platform:   ${platform} (${version})`);

  const proc = spawn({
    cmd,
    cwd: program.isolateDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, errors, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

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
