import { extensionFromFilename, temporaryPath, downloadUrl, removeIfExists } from '../infrastructure/files.js';

export class TrackDownloadService {
  constructor({ providers, tempDir, timeoutMs }) {
    this.providers = new Map(providers.map((provider) => [provider.name, provider]));
    this.tempDir = tempDir;
    this.timeoutMs = timeoutMs;
  }

  async download(track) {
    const provider = this.providers.get(track.source);
    if (!provider) throw new Error(`Unknown music provider: ${track.source}`);

    if (track.source === 'youtube') {
      return provider.download(track);
    }

    const resolved = await provider.resolveDownload(track);
    const extension = extensionFromFilename(new URL(resolved.url).pathname, '.mp3');
    const filePath = temporaryPath(this.tempDir, extension);
    try {
      await downloadUrl(resolved.url, filePath, { timeoutMs: this.timeoutMs });
      return { filePath, track: resolved };
    } catch (error) {
      await removeIfExists(filePath);
      throw error;
    }
  }
}
