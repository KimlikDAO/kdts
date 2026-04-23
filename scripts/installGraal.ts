import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { capture, run } from "./run";

const GraalUrl = "https://download.oracle.com/graalvm/21/latest/graalvm-jdk-21_macos-aarch64_bin.tar.gz";
const CacheDir = resolve(".cache", "graalvm");
const ArchivePath = join(CacheDir, "graalvm-jdk-21_macos-aarch64_bin.tar.gz");
const CurrentDir = join(CacheDir, "current");
const NativeImagePath = join(CurrentDir, "Contents", "Home", "bin", "native-image");

if (process.platform != "darwin" || process.arch != "arm64")
  throw new Error("scripts/installGraal.ts currently supports only macOS arm64.");

if (existsSync(NativeImagePath))
  process.exit(0);

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
