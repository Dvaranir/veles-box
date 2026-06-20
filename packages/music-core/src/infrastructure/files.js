import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

export function safeFilenamePart(value, fallback = 'Unknown') {
  const cleaned = String(value || '').replace(INVALID_FILENAME_CHARS, '_').replace(/\s+/g, ' ').replace(/^\.+|\.+$/g, '').trim();
  return cleaned || fallback;
}

export function extensionFromFilename(filename, fallback = '.mp3') {
  const extension = path.extname(filename || '').toLowerCase();
  return extension && extension.length <= 10 ? extension : fallback;
}

export function temporaryPath(tempDir, extension = '.tmp') {
  return path.join(tempDir, `${crypto.randomUUID()}${extension}`);
}

export async function ensureDirectories(...directories) {
  await Promise.all(directories.map((directory) => fs.mkdir(directory, { recursive: true })));
}

export async function moveFile(source, destination) {
  try {
    await fs.rename(source, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(source, destination);
    await fs.unlink(source);
  }
}

export async function removeIfExists(filePath) {
  if (filePath) await fs.rm(filePath, { force: true }).catch(() => undefined);
}

export async function findAvailablePath(directory, filename) {
  const extension = path.extname(filename);
  const basename = path.basename(filename, extension);
  for (let index = 0; index < 10_000; index += 1) {
    const suffix = index === 0 ? '' : ` (${index})`;
    const candidate = path.join(directory, `${basename}${suffix}${extension}`);
    try { await fs.access(candidate); } catch { return candidate; }
  }
  throw new Error('Could not find a free filename');
}

export async function downloadResponse(response, destination) {
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  const handle = await fs.open(destination, 'w');
  await pipeline(Readable.fromWeb(response.body), handle.createWriteStream());
}

export async function downloadUrl(url, destination, { timeoutMs = 120_000, headers = {}, redirect = 'follow' } = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect });
  await downloadResponse(response, destination);
  return response;
}
