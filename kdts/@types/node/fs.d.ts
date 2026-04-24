import { BufferEncoding } from "./buffer.d";

export function readFileSync(
  path: string, options: BufferEncoding
): Uint8Array | string;

export function existsSync(path: string): boolean;
