import { mkdirSync, mkdtempSync } from "node:fs";
import { combine } from "../paths";

const TEST_TEMP_ROOT = combine("build", "tmp");

const createBuildTempDir = (prefix: string): string => {
  mkdirSync(TEST_TEMP_ROOT, { recursive: true });
  return mkdtempSync(combine(TEST_TEMP_ROOT, `${prefix}-`));
};

export { TEST_TEMP_ROOT, createBuildTempDir };
