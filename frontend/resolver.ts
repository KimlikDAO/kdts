import { existsSync, readFileSync, statSync } from "node:fs";
import { combine, getDir, replaceExt } from "../util/paths";
import { SourceId, Source } from "../model/source";
import { JsLikeExt, moduleAtPath } from "./sourcePath";

const PackageRoots = [
  "@types",
  "node_modules/@kimlikdao/kdts/@types",
  "node_modules"
] as const;

type PackageJson = {
  main?: string;
  types?: string;
  typings?: string;
};

const isFile = (path: string): boolean => {
  try {
    return !statSync(path).isDirectory();
  } catch {
    return false;
  }
}

const resolveExt = (path: string): string => {
  if (isFile(path)) return path;
  for (const ext of JsLikeExt)
    if (isFile(path + ext)) return path + ext;
  return "";
}

const resolveDeclaration = (path: string): string => {
  if (isFile(path)) return path;
  if (isFile(path + ".d.ts")) return path + ".d.ts";
  if (isFile(path + ".d.js")) return path + ".d.js";
  if (isFile(path + ".ts")) return path + ".ts";
  if (isFile(combine(path, "index.d.ts"))) return combine(path, "index.d.ts");
  if (isFile(combine(path, "index.d.js"))) return combine(path, "index.d.js");
  if (isFile(combine(path, "index.ts"))) return combine(path, "index.ts");
  return "";
}

const splitPackagePath = (path: string): [string, string] => {
  const colon = path.indexOf(":");
  const slash = path.indexOf("/");
  if (colon != -1 && (slash == -1 || colon < slash))
    return [path.slice(0, colon), "/" + path.slice(colon + 1)];

  const parts = path.split("/");
  const packageName = path.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : parts[0]!;
  return [packageName, path.slice(packageName.length)];
}

const resolveRootImport = (packageDir: string, packageJson: PackageJson): string => {
  const declarationPath = packageJson.types
    || packageJson.typings
    || (packageJson.main && replaceExt(packageJson.main, ".d.ts"))
    || "index";
  return resolveDeclaration(combine(packageDir, declarationPath));
}

const resolvePackageFrom = (
  packageDir: string,
  packageName: string,
  subpath: string
): string => {
  if (!existsSync(packageDir))
    return "";

  const packageJsonPath = combine(packageDir, "package.json");
  if (!isFile(packageJsonPath))
    throw Error(`Package ${packageName} is missing package.json`);

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
  const path = subpath
    ? resolveDeclaration(combine(packageDir, subpath.slice(1)))
    : resolveRootImport(packageDir, packageJson);
  return path.startsWith("@") ? "./" + path : path;
}

const resolvePackage = (packagePath: string): string => {
  const [packageName, subpath] = splitPackagePath(packagePath);
  for (const packageRoot of PackageRoots) {
    const resolvedPath = resolvePackageFrom(
      combine(packageRoot, packageName),
      packageName,
      subpath
    );
    if (resolvedPath)
      return resolvedPath;
  }
  return "";
}

const resolvePath = (importer: string, path: string): Source => {
  switch (path[0]) {
    case ".":
      return moduleAtPath(resolveExt(combine(getDir(importer), path)));
    case "/":
      return moduleAtPath(resolveExt(path.slice(1)));
    default:
      const packagePath = path;
      const id: SourceId = `package:${packagePath}`;
      const resolvedPath = resolvePackage(packagePath);
      if (resolvedPath)
        return { path: resolvedPath, id };
      throw Error(`No types for package ${packagePath} found!`);
  }
}

const resolveRootPath = (path: string) => resolvePath("", "./" + path);

export {
  resolvePath,
  resolveRootPath
};
