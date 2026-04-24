import { file } from "bun";
import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";
import { compile } from "../../compiler";
import { createBuildTempDir } from "./temp";

type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CompileE2EResult = {
  code: string;
  output: string;
  writtenCode: string;
  cleanup: () => void;
  run: () => Promise<RunResult>;
};

const compileEntry = async (entry: string): Promise<CompileE2EResult> => {
  const dir = createBuildTempDir("kdts-e2e");
  const output = join(dir, basename(entry).replace(/\.ts$/, ".out.js"));
  const code = await compile({ target: [entry], output, strict: true });
  if (typeof code != "string")
    throw new Error(`Expected compile() to return code for ${entry}`);

  const writtenCode = await file(output).text();

  return {
    code,
    output,
    writtenCode,
    cleanup: () => rmSync(dir, { force: true, recursive: true }),
    run: () => new Promise<RunResult>((resolve, reject) => {
      const stdoutPath = join(dir, "stdout.txt");
      const stderrPath = join(dir, "stderr.txt");
      const stdoutFd = openSync(stdoutPath, "w");
      const stderrFd = openSync(stderrPath, "w");
      const proc = spawn("node", [output], {
        cwd: process.cwd(),
        stdio: ["ignore", stdoutFd, stderrFd],
      });

      proc.on("error", (error) => {
        closeSync(stdoutFd);
        closeSync(stderrFd);
        reject(error);
      });
      proc.on("close", (code) => {
        closeSync(stdoutFd);
        closeSync(stderrFd);
        resolve({
          exitCode: code ?? 1,
          stdout: readFileSync(stdoutPath, "utf8"),
          stderr: readFileSync(stderrPath, "utf8"),
        });
      });
    }),
  };
};

export { compileEntry };
