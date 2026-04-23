const run = (
  cmd: string[],
  cwd = process.cwd(),
  env?: Record<string, string>,
): void => {
  const proc = Bun.spawnSync({
    cmd,
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
    cmd,
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
