import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  getNativeCompilerBuildDir,
  NativeCompilerPackages
} from "../gcc/nativePackages";
import { run } from "./run";

const BuildRootDir = join("build", "kdts");
const NpmCacheDir = resolve(".cache", "npm");
const dryRun = process.argv.includes("--dry-run");

const publishDir = (dir: string) => {
  const args = ["npm", "publish", "--access", "public"];
  if (dryRun)
    args.push("--dry-run");
  run(args, resolve(dir), {
    NPM_CONFIG_CACHE: NpmCacheDir,
    npm_config_cache: NpmCacheDir,
  });
};

for (const nativePackage of NativeCompilerPackages) {
  const buildDir = getNativeCompilerBuildDir(nativePackage);
  if (existsSync(buildDir))
    publishDir(buildDir);
}

if (!existsSync(BuildRootDir))
  throw new Error(`Missing ${BuildRootDir}. Run the build step before publishing.`);
publishDir(BuildRootDir);
