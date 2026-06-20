import crypto from 'node:crypto';
import path from 'node:path';
import { createTrack, splitArtistTitle } from '../domain/tracks.js';
import { runCommand } from '../infrastructure/command.js';

function entryToTrack(entry) {
  const parsed = splitArtistTitle(entry.title);
  return createTrack({
    source: 'youtube', id: `yt-${entry.id}`,
    artist: parsed?.artist || entry.uploader || entry.channel || '',
    title: parsed?.title || entry.title || '', duration: entry.duration_string || '', bitrate: entry.abr,
    url: entry.webpage_url || entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : undefined),
  });
}

function parseJson(stdout) {
  if (!stdout.trim()) throw new Error('yt-dlp did not return metadata');
  return JSON.parse(stdout.trim());
}

export function isYouTubeUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'youtu.be' || hostname.endsWith('.youtu.be') || hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
  } catch { return false; }
}

export class YouTubeProvider {
  constructor({ ytDlpPath, tempDir, timeoutMs, searchLimit, commandRunner = runCommand }) {
    Object.assign(this, { name: 'youtube', ytDlpPath, tempDir, timeoutMs, searchLimit, commandRunner });
  }

  async search(query) {
    const { stdout } = await this.commandRunner(this.ytDlpPath, ['--flat-playlist', '--dump-single-json', '--no-warnings', `ytsearch${this.searchLimit}:${query}`], { timeoutMs: this.timeoutMs });
    return (parseJson(stdout).entries || []).map(entryToTrack).filter((track) => track.title);
  }

  async inspectUrl(url) {
    const { stdout } = await this.commandRunner(this.ytDlpPath, ['--no-playlist', '--dump-single-json', '--skip-download', '--no-warnings', url], { timeoutMs: this.timeoutMs });
    return entryToTrack(parseJson(stdout));
  }

  async download(track) {
    const outputTemplate = path.join(this.tempDir, `${crypto.randomUUID()}.%(ext)s`);
    const { stdout } = await this.commandRunner(this.ytDlpPath, [
      '--no-playlist', '--no-progress', '--quiet', '--no-part', '--format', 'bestaudio/best',
      '--output', outputTemplate, '--print', 'after_move:filepath', track.url,
    ], { timeoutMs: this.timeoutMs });
    const filePath = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (!filePath) throw new Error('yt-dlp did not return a downloaded file path');
    return { filePath, track };
  }
}
