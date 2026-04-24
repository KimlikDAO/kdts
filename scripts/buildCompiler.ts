import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { capture, run } from "./run";

const BuiltCompilerJar = resolve("build", "compiler", "compiler.jar");
const BazelCompilerJar = resolve("gcc", "bazel-bin", "compiler_uberjar_deploy.jar");
const BazelOutputRoot = resolve(".cache", "bazel");

const copyCompilerJar = (jarPath: string): string => {
  mkdirSync(dirname(BuiltCompilerJar), { recursive: true });
  copyFileSync(jarPath, BuiltCompilerJar);
  return BuiltCompilerJar;
};

const readCompilerVersion = (packageVersion: string): string => {
  try {
    const revision = capture(["git", "-C", "gcc", "rev-parse", "--short=12", "HEAD"]);
    return `kdts-${packageVersion}-${revision}`;
  } catch {
    return `kdts-${packageVersion}`;
  }
};

const ensureCompilerJar = (
  packageVersion: string,
  providedPath = "",
): string => {
  if (providedPath) {
    const absolutePath = resolve(providedPath);
    if (!existsSync(absolutePath))
      throw new Error(`Compiler jar not found: ${absolutePath}`);
    if (absolutePath == BuiltCompilerJar)
      return BuiltCompilerJar;
    return copyCompilerJar(absolutePath);
  }
  if (existsSync(BuiltCompilerJar))
    return BuiltCompilerJar;
  if (!existsSync("gcc/.bazelversion"))
    throw new Error("Missing gcc submodule. Run `git submodule update --init --recursive`.");
  if (!existsSync(BazelCompilerJar)) {
    run([
      "bazelisk",
      `--output_user_root=${BazelOutputRoot}`,
      "--batch",
      "build",
      "--color=yes",
      "//:compiler_uberjar_deploy.jar",
      `--define=COMPILER_VERSION=${readCompilerVersion(packageVersion)}`,
    ], "gcc");
  }
  if (!existsSync(BazelCompilerJar))
    throw new Error(`Bazel build did not produce ${BazelCompilerJar}`);
  return copyCompilerJar(BazelCompilerJar);
};

export {
  BuiltCompilerJar,
  ensureCompilerJar,
};
