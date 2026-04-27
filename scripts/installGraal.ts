import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { capture, run } from "./run";

const GraalMajorVersion = 25;
const GraalUrl =
  `https://download.oracle.com/graalvm/${GraalMajorVersion}/latest/graalvm-jdk-${GraalMajorVersion}_macos-aarch64_bin.tar.gz`;
const CacheDir = resolve(".cache", "graalvm");
const ArchivePath = join(
  CacheDir,
  `graalvm-jdk-${GraalMajorVersion}_macos-aarch64_bin.tar.gz`,
);
const CurrentDir = join(CacheDir, "current");
const NativeImagePath = join(CurrentDir, "Contents", "Home", "bin", "native-image");

const readNativeImageMajorVersion = (): number | null => {
  if (!existsSync(NativeImagePath))
    return null;
  try {
    const versionOutput = capture([NativeImagePath, "--version"]);
    const match = versionOutput.match(/native-image\s+(\d+)(?:[.\s]|$)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
};

if (process.platform != "darwin" || process.arch != "arm64")
  throw new Error("scripts/installGraal.ts currently supports only macOS arm64.");

const installedMajorVersion = readNativeImageMajorVersion();
if (installedMajorVersion == GraalMajorVersion)
  process.exit(0);
if (installedMajorVersion != null)
  throw new Error(
    `Found GraalVM ${installedMajorVersion} in ${CurrentDir}. ` +
    `Delete it manually before installing GraalVM ${GraalMajorVersion}.`,
  );

mkdirSync(CacheDir, { recursive: true });
if (!existsSync(ArchivePath))
  run(["curl", "-L", "--fail", GraalUrl, "-o", ArchivePath]);

const archiveRoot = capture(["tar", "-tzf", ArchivePath])
  .split("\n")
  .find(Boolean)?.split("/")[0];
if (!archiveRoot)
  throw new Error(`Could not determine GraalVM archive root from ${ArchivePath}`);

const extractedDir = join(CacheDir, archiveRoot);
if (!existsSync(extractedDir))
  run(["tar", "-xzf", ArchivePath, "-C", CacheDir]);

rmSync(CurrentDir, { recursive: true, force: true });
symlinkSync(extractedDir, CurrentDir, "dir");

readdirSync(join(CurrentDir, "Contents", "Home", "bin"));
if (!existsSync(NativeImagePath))
  throw new Error(`native-image was not found in ${join(CurrentDir, "Contents", "Home", "bin")}`);
