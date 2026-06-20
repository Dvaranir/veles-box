import fs from 'node:fs/promises';
import path from 'node:path';
import NodeID3 from 'node-id3';
import { extensionFromFilename, removeIfExists, temporaryPath } from '../infrastructure/files.js';
import { runCommand } from '../infrastructure/command.js';
import { cleanText, splitArtistTitle } from '../domain/tracks.js';

const TAGGABLE_EXTENSIONS = new Set(['.mp3', '.m4a', '.mp4', '.flac', '.ogg']);

function ffmpegMetadataArguments(metadata) {
  return ['-metadata', `title=${metadata.title || ''}`, '-metadata', `artist=${metadata.artist || ''}`, '-metadata', `album=${metadata.album || ''}`];
}

export async function readAudioMetadata(filePath, { commandRunner = runCommand } = {}) {
  try {
    const { stdout } = await commandRunner('ffprobe', ['-v', 'error', '-show_entries', 'format_tags=title,artist,album:stream=codec_type:stream_disposition', '-of', 'json', filePath]);
    const probe = JSON.parse(stdout);
    const tags = probe.format?.tags || {};
    const hasCover = (probe.streams || []).some((stream) => stream.codec_type === 'video' && Boolean(stream.disposition?.attached_pic));
    return { artist: cleanText(tags.artist || tags.ARTIST), title: cleanText(tags.title || tags.TITLE), album: cleanText(tags.album || tags.ALBUM), hasCover };
  } catch { return { artist: '', title: '', album: '', hasCover: false }; }
}

export function inferMetadataFromFilename(filename) {
  const parsed = splitArtistTitle(path.basename(filename, path.extname(filename)));
  return parsed ? { ...parsed, album: '' } : { artist: '', title: '', album: '' };
}

export async function prepareWritableAudio(filePath, { tempDir, hasNewCover, commandRunner = runCommand }) {
  const extension = extensionFromFilename(filePath);
  // New artwork is embedded as raw WebP APIC data, which is deliberately MP3-only.
  const needsConversion = !TAGGABLE_EXTENSIONS.has(extension) || (hasNewCover && extension !== '.mp3');
  if (!needsConversion) return { filePath, extension, converted: false };
  const target = temporaryPath(tempDir, '.mp3');
  await commandRunner('ffmpeg', ['-y', '-i', filePath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', target]);
  await removeIfExists(filePath);
  return { filePath: target, extension: '.mp3', converted: true };
}

export async function writeAudioMetadata(filePath, metadata, { tempDir, coverPath, commandRunner = runCommand } = {}) {
  const extension = extensionFromFilename(filePath);
  const outputPath = temporaryPath(tempDir, extension);
  if (coverPath && extension === '.mp3') {
    await fs.copyFile(filePath, outputPath);
    const imageBuffer = await fs.readFile(coverPath);
    const written = NodeID3.write({
      title: metadata.title || '', artist: metadata.artist || '', album: metadata.album || '',
      image: { mime: 'image/webp', type: { id: 3, name: 'front cover' }, imageBuffer },
    }, outputPath);
    if (!written) throw new Error('Unable to write WebP artwork to ID3 metadata');
  } else {
    await commandRunner('ffmpeg', ['-y', '-i', filePath, '-map', '0', '-c', 'copy', ...ffmpegMetadataArguments(metadata), outputPath]);
  }
  await fs.rm(filePath, { force: true });
  return outputPath;
}
