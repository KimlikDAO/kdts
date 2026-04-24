import {
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync
} from "node:fs";
import { resolve, sep } from "node:path";

const cwd = process.cwd();

if (cwd.split(sep).includes("node_modules"))
  process.exit(0);

const packageDir = "node_modules/@kimlikdao";
const linkPath = "node_modules/@kimlikdao/kdts";
const linkTarget = "../..";
const expectedTarget = resolve(".");

mkdirSync(packageDir, { recursive: true });

try {
  const stat = lstatSync(linkPath);
  if (stat.isSymbolicLink()) {
    const targetPath = resolve(packageDir, readlinkSync(linkPath));
    if (targetPath === expectedTarget)
      process.exit(0);
    unlinkSync(linkPath);
  } else {
    console.warn(`Skipping kdts self-link because ${linkPath} already exists.`);
    process.exit(0);
  }
} catch (error) {
  if (!(error && typeof error == "object" && "code" in error && error.code === "ENOENT"))
    throw error;
}

symlinkSync(linkTarget, linkPath, "dir");
