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

const toBackendVersion = (version: string): string => {
  const parts = version.split(".");
  if (parts.length != 3)
    throw new Error(`Expected semantic version x.y.z, got ${version}`);
  parts[2] = "0";
  return parts.join(".");
};

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
  const releaseVersion = readPackageJson(".").version;
  const backendVersion = toBackendVersion(releaseVersion);
  const pkg = readPackageJson(dir);
  if (!dryRun && await isPackageVersionPublished(pkg.name, pkg.version)) {
    if (dir != BuildRootDir && releaseVersion != backendVersion) {
      console.info(`Skipping ${pkg.name}@${pkg.version}; reusing published backend package.`);
      return;
    }
    throw new Error(`${pkg.name}@${pkg.version} is already published.`);
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
