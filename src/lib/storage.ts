import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Uploaded work is written outside /public and only ever reachable through the download route,
 * which checks the session first. The name on disk is a fresh UUID — a filename supplied by a
 * student is never used to build a path, so "../../.env" cannot escape the directory.
 */
function uploadRoot(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "storage/submissions");
}

export async function saveUpload(bytes: Uint8Array, extension: string): Promise<string> {
  const root = uploadRoot();
  await mkdir(root, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  await writeFile(path.join(root, storedName), bytes);
  return storedName;
}

export async function readUpload(storedName: string): Promise<Buffer> {
  // Defence in depth: reject anything that is not a plain file name.
  if (!/^[a-z0-9-]+\.(pdf|docx)$/i.test(storedName)) {
    throw new Error(`Refusing to read suspicious stored name: ${storedName}`);
  }
  return readFile(path.join(uploadRoot(), storedName));
}
