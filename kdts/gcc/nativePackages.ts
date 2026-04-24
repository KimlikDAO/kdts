type NativeCompilerPackage = {
  id: string;
  displayName: string;
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
};

const NativeCompilerPackages: readonly NativeCompilerPackage[] = [
  {
    id: "macos",
    displayName: "macOS",
    platform: "darwin",
    arch: "arm64",
  },
  {
    id: "linux",
    displayName: "Linux",
    platform: "linux",
    arch: "x64",
  },
  {
    id: "linux-arm64",
    displayName: "Linux arm64",
    platform: "linux",
    arch: "arm64",
  },
  {
    id: "windows",
    displayName: "Windows",
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
  `@kimlikdao/gcc-${id}`;

const getStockCompilerPackageName = ({ id }: NativeCompilerPackage): string =>
  `google-closure-compiler-${id}`;

const getNativeCompilerBuildDir = ({ id }: NativeCompilerPackage): string =>
  `build/gcc-${id}`;

const getNativeCompilerFile = ({ id }: NativeCompilerPackage): string =>
  id == "windows" ? "compiler.exe" : "compiler";

export {
  getNativeCompilerBuildDir,
  getNativeCompilerFile,
  getNativeCompilerPackage,
  getNativeCompilerPackageName,
  getStockCompilerPackageName,
  NativeCompilerPackages,
};
export type { NativeCompilerPackage };
