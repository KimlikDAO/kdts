type NativeCompilerPackage = {
  id: string;
  displayName: string;
  platform: NodeJS.Platform;
  arch: "arm64" | "x64";
};

const NativeCompilerPackages: readonly NativeCompilerPackage[] = [{
  id: "macos",
  displayName: "macOS",
  platform: "darwin",
  arch: "arm64",
}, {
  id: "linux",
  displayName: "Linux",
  platform: "linux",
  arch: "x64",
}, {
  id: "linux-arm64",
  displayName: "Linux arm64",
  platform: "linux",
  arch: "arm64",
}, {
  id: "windows",
  displayName: "Windows",
  platform: "win32",
  arch: "x64",
}] as const;

const getNativeCompilerPackage = (
  platform = process.platform,
  arch = process.arch,
): NativeCompilerPackage | undefined =>
  NativeCompilerPackages.find(
    (pkg) => pkg.platform == platform && pkg.arch == arch,
  );

const getNativePackageCompiler = (
  platform = process.platform,
  arch = process.arch,
): { package: string; compiler: string } | undefined => {
  const nativePackage = getNativeCompilerPackage(platform, arch);
  if (!nativePackage)
    return undefined;
  return {
    package: `@kimlikdao/gcc-${nativePackage.id}`,
    compiler: nativePackage.id == "windows" ? "compiler.exe" : "compiler",
  };
};

const getNativeCompilerPackageName = ({ id }: NativeCompilerPackage): string =>
  `@kimlikdao/gcc-${id}`;

const getNativeCompilerBuildDir = ({ id }: NativeCompilerPackage): string =>
  `build/gcc-${id}`;

const getNativeCompilerFile = ({ id }: NativeCompilerPackage): string =>
  id == "windows" ? "compiler.exe" : "compiler";

export {
  getNativeCompilerBuildDir,
  getNativeCompilerFile,
  getNativeCompilerPackage,
  getNativeCompilerPackageName,
  getNativePackageCompiler,
  NativeCompilerPackage,
  NativeCompilerPackages
};
