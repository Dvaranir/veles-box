import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { CoverService } from '../src/services/cover-service.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+3MxZygAAAABJRU5ErkJggg==', 'base64');

test('keeps a downloaded Yandex cover until it has been converted to WebP', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'veles-cover-'));
  let sourcePath;
  const service = new CoverService({
    tempDir,
    maxBytes: 1024 * 1024,
    timeoutMs: 1_000,
    download: async (_url, destination) => {
      sourcePath = destination;
      await fs.writeFile(destination, PNG);
      return { headers: new Headers({ 'content-length': String(PNG.length) }) };
    },
  });

  try {
    const webpPath = await service.fromYandex('https://avatars.yandex.net/get-music-content/1/cover/100x100');
    assert.equal((await sharp(webpPath).metadata()).format, 'webp');
    await assert.rejects(fs.access(sourcePath));
    await fs.rm(webpPath, { force: true });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
