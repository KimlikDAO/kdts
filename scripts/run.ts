const quoteWindowsArg = (arg: string): string => {
  if (!arg.length)
    return "\"\"";
  if (!/[\s"&|<>^()]/.test(arg))
    return arg;
  return `"${arg.replaceAll("\"", "\"\"")}"`;
};

const normalizeCommand = (cmd: string[]): string[] => {
  const [program] = cmd;
  if (process.platform != "win32" || !program || !/\.(cmd|bat)$/i.test(program))
    return cmd;
  return [
    "cmd.exe",
    "/d",
    "/s",
    "/c",
    cmd.map(quoteWindowsArg).join(" "),
  ];
};

const run = (
  cmd: string[],
  cwd = process.cwd(),
  env?: Record<string, string>,
): void => {
  const proc = Bun.spawnSync({
    cmd: normalizeCommand(cmd),
    cwd,
    env: env ? { ...process.env, ...env } : undefined,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode)
    throw new Error(`${cmd.join(" ")} failed with exit code ${proc.exitCode}`);
};

const capture = (
  cmd: string[],
  cwd = process.cwd(),
  env?: Record<string, string>,
): string => {
  const proc = Bun.spawnSync({
    cmd: normalizeCommand(cmd),
    cwd,
    env: env ? { ...process.env, ...env } : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode) {
    const errors = proc.stderr.toString().trim();
    throw new Error(`${cmd.join(" ")} failed${errors ? `\n${errors}` : ""}`);
  }
  return proc.stdout.toString().trim();
};

export {
  capture,
  run,
};
