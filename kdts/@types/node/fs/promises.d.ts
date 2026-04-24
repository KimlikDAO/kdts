import { BufferEncoding } from "../buffer.d";

export function readdir(path: string): Promise<string[]>;

export function readFile(
  path: string, options: BufferEncoding
): Promise<Uint8Array | string>;

export function writeFile(
  path: string, data: string | Uint8Array
): Promise<void>;
