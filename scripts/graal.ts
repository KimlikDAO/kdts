import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { NativeCompilerPackage } from "../kdts/gcc/nativePackages";
import { capture, run } from "./run";

const FlagsByPlatformAndArch = new Map([
  ["linux-x64", ["--static", "--libc=musl"]],
  ["linux-arm64", ["--static-nolibc"]],
]);

const resolveNativeImage = (): string => {
  const nativeImageCommand = process.platform == "win32"
    ? "native-image.cmd"
    : "native-image";
  const candidates = [
    process.env["GRAALVM_HOME"] && join(process.env["GRAALVM_HOME"], "bin", nativeImageCommand),
    process.env["GRAALVM_HOME"] && join(process.env["GRAALVM_HOME"], "bin", "native-image"),
    resolve(".cache", "graalvm", "current", "Contents", "Home", "bin", nativeImageCommand),
    resolve(".cache", "graalvm", "current", "Contents", "Home", "bin", "native-image"),
    resolve(".cache", "graalvm", "current", "bin", nativeImageCommand),
    resolve(".cache", "graalvm", "current", "bin", "native-image"),
    nativeImageCommand,
    "native-image",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (candidate == nativeImageCommand || candidate == "native-image" || existsSync(candidate))
      return candidate;
  }
  throw new Error(
    "native-image not found. Run `bun ./scripts/installGraal.ts` or set GRAALVM_HOME.",
  );
};

const readNativeImageMajorVersion = (nativeImage: string): number | null => {
  try {
    const versionOutput = capture([nativeImage, "--version"]);
    const match = versionOutput.match(/native-image\s+(\d+)(?:[.\s]|$)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
};

const buildNativeCompiler = (
  nativePackage: NativeCompilerPackage,
  cwd: string,
): void => {
  if (!existsSync(resolve(cwd, "compiler.jar")))
    throw new Error(`Missing compiler.jar in ${cwd}`);

  const reflectionConfig = resolve("scripts", "graal", "reflection-config.json");
  const nativeImage = resolveNativeImage();
  const nativeImageMajorVersion = readNativeImageMajorVersion(nativeImage);
  const nativeImageTempDir = process.platform == "win32"
    ? ""
    : resolve("/tmp", "kdts-native-image");
  if (nativeImageTempDir)
    mkdirSync(nativeImageTempDir, { recursive: true });
  const nativeImageArgs = [
    "-H:+UnlockExperimentalVMOptions",
    ...(nativeImageTempDir ? [`-J-Djava.io.tmpdir=${nativeImageTempDir}`] : []),
    ...(FlagsByPlatformAndArch.get(`${nativePackage.platform}-${nativePackage.arch}`) || []),
    "-H:IncludeResourceBundles=org.kohsuke.args4j.Messages",
    "-H:IncludeResourceBundles=org.kohsuke.args4j.spi.Messages",
    "-H:IncludeResourceBundles=com.google.javascript.jscomp.parsing.ParserConfig",
    "-H:+AllowIncompleteClasspath",
    `-H:ReflectionConfigurationFiles=${reflectionConfig}`,
    "-H:IncludeResources=externs\\.zip",
    "-H:IncludeResources=.*\\.typedast",
    "-H:IncludeResources=com/google/javascript/.*\\.js",
    "-H:IncludeResources=com/google/javascript/.*\\.txt",
    "-H:IncludeResources=lib/.*\\.js",
    "-H:IncludeResources=META-INF/.*\\.txt",
    "-H:+ReportExceptionStackTraces",
    ...(nativeImageMajorVersion != null && nativeImageMajorVersion >= 24
      ? ["-J--sun-misc-unsafe-memory-access=allow"]
      : []),
    "--initialize-at-build-time",
    "-march=compatibility",
    "--no-fallback",
    "--color=always",
    "-jar",
    "compiler.jar",
  ];
  run(
    [nativeImage, ...nativeImageArgs],
    cwd,
    nativeImageTempDir
      ? {
        TEMP: nativeImageTempDir,
        TMP: nativeImageTempDir,
        TMPDIR: nativeImageTempDir,
      }
      : undefined,
  );
};

export { buildNativeCompiler };
