import { lstatSync, mkdirSync, readlinkSync, symlinkSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const cwd = process.cwd();

if (cwd.split(sep).includes("node_modules"))
  process.exit(0);

const packageDir = join(cwd, "node_modules", "@kimlikdao");
const linkPath = join(packageDir, "kdts");
const linkTarget = "../..";

mkdirSync(packageDir, { recursive: true });

try {
  const stat = lstatSync(linkPath);
  if (stat.isSymbolicLink()) {
    const targetPath = resolve(dirname(linkPath), readlinkSync(linkPath));
    if (targetPath === cwd)
      process.exit(0);
  }
  console.warn(`Skipping kdts self-link because ${linkPath} already exists.`);
  process.exit(0);
} catch (error) {
  if (!(error && typeof error == "object" && "code" in error && error.code === "ENOENT"))
    throw error;
}

symlinkSync(linkTarget, linkPath, "dir");
