type NativeCompilerPackage = {
  id: string;
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
};

const NativeCompilerPackages: readonly NativeCompilerPackage[] = [
  {
    id: "macos",
    platform: "darwin",
    arch: "arm64",
  },
  {
    id: "linux",
    platform: "linux",
    arch: "x64",
  },
  {
    id: "linux-arm64",
    platform: "linux",
    arch: "arm64",
  },
  {
    id: "windows",
    platform: "win32",
    arch: "x64",
  },
] as const;

const getNativeCompilerPackage = (
  platform = process.platform,
  arch = process.arch,
): NativeCompilerPackage | undefined =>
  NativeCompilerPackages.find(
    (pkg) => pkg.platform == platform && pkg.arch == arch,
  );

const getNativeCompilerPackageName = ({ id }: NativeCompilerPackage): string =>
  `@kimlikdao/kdts-${id}`;

const getStockCompilerPackageName = ({ id }: NativeCompilerPackage): string =>
  `google-closure-compiler-${id}`;

const getNativeCompilerPackageDir = ({ id }: NativeCompilerPackage): string =>
  `native/${id}`;

const getNativeCompilerBuildDir = ({ id }: NativeCompilerPackage): string =>
  `build/kdts-${id}`;

const getNativeCompilerFile = ({ id }: NativeCompilerPackage): string =>
  id == "windows" ? "compiler.exe" : "compiler";

export {
  getNativeCompilerBuildDir,
  getNativeCompilerFile,
  getNativeCompilerPackage,
  getNativeCompilerPackageDir,
  getNativeCompilerPackageName,
  getStockCompilerPackageName,
  NativeCompilerPackages,
};
export type { NativeCompilerPackage };
