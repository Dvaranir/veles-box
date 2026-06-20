import fs from 'node:fs/promises';
import path from 'node:path';
import { extensionFromFilename, removeIfExists, temporaryPath } from '../infrastructure/files.js';
import { runCommand } from '../infrastructure/command.js';
import { cleanText, splitArtistTitle } from '../domain/tracks.js';

const TAGGABLE_EXTENSIONS = new Set(['.mp3', '.m4a', '.mp4', '.flac', '.ogg']);
const COVER_EXTENSIONS = new Set(['.mp3', '.m4a', '.mp4']);

function ffmpegMetadataArguments(metadata) {
  return [
    '-metadata', `title=${metadata.title || ''}`,
    '-metadata', `artist=${metadata.artist || ''}`,
    '-metadata', `album=${metadata.album || ''}`,
  ];
}

export async function readAudioMetadata(filePath, { commandRunner = runCommand } = {}) {
  try {
    const { stdout } = await commandRunner('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format_tags=title,artist,album:stream=codec_type:stream_disposition',
      '-of', 'json',
      filePath,
    ]);
    const probe = JSON.parse(stdout);
    const tags = probe.format?.tags || {};
    const hasCover = (probe.streams || []).some((stream) => (
      stream.codec_type === 'video' && (stream.disposition?.attached_pic === 1 || stream.disposition?.attached_pic === true)
    ));
    return {
      artist: cleanText(tags.artist || tags.ARTIST),
      title: cleanText(tags.title || tags.TITLE),
      album: cleanText(tags.album || tags.ALBUM),
      hasCover,
    };
  } catch {
    return { artist: '', title: '', album: '', hasCover: false };
  }
}

export function inferMetadataFromFilename(filename) {
  const parsed = splitArtistTitle(path.basename(filename, path.extname(filename)));
  return parsed ? { ...parsed, album: '' } : { artist: '', title: '', album: '' };
}

export async function prepareWritableAudio(filePath, { tempDir, hasNewCover, commandRunner = runCommand }) {
  const extension = extensionFromFilename(filePath);
  const needsConversion = !TAGGABLE_EXTENSIONS.has(extension) || (hasNewCover && !COVER_EXTENSIONS.has(extension));
  if (!needsConversion) return { filePath, extension, converted: false };

  const target = temporaryPath(tempDir, '.mp3');
  await commandRunner('ffmpeg', [
    '-y', '-i', filePath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', target,
  ]);
  await removeIfExists(filePath);
  return { filePath: target, extension: '.mp3', converted: true };
}

export async function writeAudioMetadata(filePath, metadata, {
  tempDir,
  coverPath,
  commandRunner = runCommand,
} = {}) {
  const extension = extensionFromFilename(filePath);
  const outputPath = temporaryPath(tempDir, extension);
  const common = ['-y', '-i', filePath];

  if (!coverPath) {
    await commandRunner('ffmpeg', [
      ...common,
      '-map', '0',
      '-c', 'copy',
      ...ffmpegMetadataArguments(metadata),
      outputPath,
    ]);
  } else if (extension === '.mp3') {
    await commandRunner('ffmpeg', [
      ...common,
      '-i', coverPath,
      '-map', '0:a:0',
      '-map', '1:v:0',
      '-c:a', 'copy',
      '-c:v', 'mjpeg',
      '-id3v2_version', '3',
      '-metadata:s:v', 'title=Album cover',
      '-metadata:s:v', 'comment=Cover (front)',
      ...ffmpegMetadataArguments(metadata),
      outputPath,
    ]);
  } else {
    await commandRunner('ffmpeg', [
      ...common,
      '-i', coverPath,
      '-map', '0:a:0',
      '-map', '1:v:0',
      '-c:a', 'copy',
      '-c:v', 'mjpeg',
      '-disposition:v:0', 'attached_pic',
      ...ffmpegMetadataArguments(metadata),
      outputPath,
    ]);
  }

  await fs.rm(filePath, { force: true });
  return outputPath;
}
