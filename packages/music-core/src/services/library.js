import path from 'node:path';
import { findAvailablePath, moveFile, removeIfExists, safeFilenamePart } from '../infrastructure/files.js';
import { prepareWritableAudio, writeAudioMetadata } from './audio-metadata.js';

export async function saveTrackToLibrary({ filePath, metadata, coverPath, tempDir, musicDir }) {
  let currentFilePath = filePath;
  try {
    const writable = await prepareWritableAudio(currentFilePath, { tempDir, hasNewCover: Boolean(coverPath) });
    currentFilePath = writable.filePath;
    currentFilePath = await writeAudioMetadata(currentFilePath, metadata, { tempDir, coverPath });
    const filename = `${safeFilenamePart(metadata.artist)} - ${safeFilenamePart(metadata.title)}${writable.extension}`;
    const destination = await findAvailablePath(musicDir, filename);
    await moveFile(currentFilePath, destination);
    currentFilePath = null;
    return { destination, converted: writable.converted };
  } finally {
    await removeIfExists(currentFilePath);
    await removeIfExists(coverPath);
  }
}
