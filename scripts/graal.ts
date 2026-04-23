import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { NativeCompilerPackage } from "../gcc/nativePackages";
import { run } from "./run";

const FlagsByPlatformAndArch = new Map([
  ["linux-x64", ["--static", "--libc=musl"]],
  ["linux-arm64", ["--static-nolibc"]],
]);

const resolveNativeImage = (): string => {
  const candidates = [
    process.env.GRAALVM_HOME && join(process.env.GRAALVM_HOME, "bin", "native-image"),
    resolve(".cache", "graalvm", "current", "Contents", "Home", "bin", "native-image"),
    resolve(".cache", "graalvm", "current", "bin", "native-image"),
    "native-image",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate == "native-image" || existsSync(candidate))
      return candidate;
  }
  throw new Error(
    "native-image not found. Run `bun ./scripts/installGraal.ts` or set GRAALVM_HOME.",
  );
};

const buildNativeCompiler = (
  nativePackage: NativeCompilerPackage,
  cwd: string,
): void => {
  if (!existsSync(resolve(cwd, "compiler.jar")))
    throw new Error(`Missing compiler.jar in ${cwd}`);

  const tempDir = resolve(".cache", "tmp");
  mkdirSync(tempDir, { recursive: true });
  const reflectionConfig = resolve("scripts", "graal", "reflection-config.json");
  const nativeImageArgs = [
    "-H:+UnlockExperimentalVMOptions",
    ...(FlagsByPlatformAndArch.get(`${nativePackage.platform}-${nativePackage.arch}`) || []),
    "-H:IncludeResourceBundles=org.kohsuke.args4j.Messages",
    "-H:IncludeResourceBundles=org.kohsuke.args4j.spi.Messages",
    "-H:IncludeResourceBundles=com.google.javascript.jscomp.parsing.ParserConfig",
    "-H:+AllowIncompleteClasspath",
    `-H:ReflectionConfigurationFiles=${reflectionConfig}`,
    `-H:QueryCodeDir=${tempDir}`,
    `-H:TempDirectory=${tempDir}`,
    "-H:IncludeResources=externs\\.zip",
    "-H:IncludeResources=.*\\.typedast",
    "-H:IncludeResources=com/google/javascript/.*\\.js",
    "-H:IncludeResources=com/google/javascript/.*\\.txt",
    "-H:IncludeResources=lib/.*\\.js",
    "-H:IncludeResources=META-INF/.*\\.txt",
    "-H:+ReportExceptionStackTraces",
    "--initialize-at-build-time",
    "-march=compatibility",
    "--no-fallback",
    "--color=always",
    "-jar",
    "compiler.jar",
  ];
  run([resolveNativeImage(), ...nativeImageArgs], cwd, {
    TEMP: tempDir,
    TMP: tempDir,
    TMPDIR: tempDir,
  });
};

export { buildNativeCompiler };
