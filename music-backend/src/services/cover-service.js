import fs from 'node:fs/promises';
import sharp from 'sharp';
import { downloadUrl, temporaryPath } from '@veles/music-core/infrastructure/files';
import { normalizeYandexCoverUrl } from './yandex-cover-url.js';

export { normalizeYandexCoverUrl } from './yandex-cover-url.js';

export class CoverService {
  constructor({ tempDir, maxBytes, timeoutMs, download = downloadUrl }) { Object.assign(this, { tempDir, maxBytes, timeoutMs, download }); }

  async fromYandex(url) {
    const sourcePath = temporaryPath(this.tempDir, '.image');
    try {
      const response = await this.download(normalizeYandexCoverUrl(url), sourcePath, { timeoutMs: this.timeoutMs, redirect: 'error' });
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > this.maxBytes) throw new Error('Yandex cover exceeds the size limit');
      const { size } = await fs.stat(sourcePath);
      if (size > this.maxBytes) throw new Error('Yandex cover exceeds the size limit');
      // Do not return the promise directly: finally would remove sourcePath
      // while Sharp is still decoding it.
      return await this.#toWebp(sourcePath);
    } finally {
      await fs.rm(sourcePath, { force: true });
    }
  }

  async fromUpload(filePath) {
    return this.#toWebp(filePath);
  }

  async #toWebp(inputPath) {
    const outputPath = temporaryPath(this.tempDir, '.webp');
    try {
      const metadata = await sharp(inputPath, { limitInputPixels: 20_000_000 }).metadata();
      if (!metadata.width || !metadata.height) throw new Error('The uploaded cover is not an image');
      await sharp(inputPath, { limitInputPixels: 20_000_000 })
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 95 })
        .toFile(outputPath);
      return outputPath;
    } catch (error) {
      await fs.rm(outputPath, { force: true });
      throw error;
    }
  }
}
