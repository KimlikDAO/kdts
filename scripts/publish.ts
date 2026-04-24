import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  getNativeCompilerBuildDir,
  NativeCompilerPackages
} from "../kdts/gcc/nativePackages";
import { run } from "./run";

const BuildRootDir = join("build", "kdts");
const NpmCacheDir = resolve(".cache", "npm");
const dryRun = process.argv.includes("--dry-run");

type PackageJson = {
  name: string;
  version: string;
};

const readPackageJson = (dir: string): PackageJson =>
  JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageJson;

const encodePackageName = (packageName: string): string =>
  encodeURIComponent(packageName).replace(/^%40/, "@");

const isPackageVersionPublished = async (
  packageName: string,
  version: string,
): Promise<boolean> => {
  const response = await fetch(
    `https://registry.npmjs.org/${encodePackageName(packageName)}/${encodeURIComponent(version)}`
  );
  return response.ok;
};

const publishDir = async (dir: string) => {
  const pkg = readPackageJson(dir);
  if (!dryRun && await isPackageVersionPublished(pkg.name, pkg.version)) {
    console.info(`Skipping ${pkg.name}@${pkg.version}; already published.`);
    return;
  }

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
    await publishDir(buildDir);
}

if (!existsSync(BuildRootDir))
  throw new Error(`Missing ${BuildRootDir}. Run the build step before publishing.`);
await publishDir(BuildRootDir);
