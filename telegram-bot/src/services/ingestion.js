import path from 'node:path';
import {
  findAvailablePath,
  moveFile,
  removeIfExists,
  safeFilenamePart,
} from '../infrastructure/files.js';
import {
  inferMetadataFromFilename,
  prepareWritableAudio,
  readAudioMetadata,
  writeAudioMetadata,
} from './audio-metadata.js';
import { mergeMetadata } from '../domain/tracks.js';

export class IngestionService {
  constructor({ sessions, metadataService, config, logger = console }) {
    this.sessions = sessions;
    this.metadataService = metadataService;
    this.config = config;
    this.logger = logger;
  }

  async start({ userId, chatId, filePath, originalFilename, seedMetadata = {} }) {
    const embedded = await readAudioMetadata(filePath);
    const inferred = inferMetadataFromFilename(originalFilename);
    const metadata = {
      artist: seedMetadata.artist || embedded.artist || inferred.artist,
      title: seedMetadata.title || embedded.title || inferred.title,
      album: seedMetadata.album || embedded.album || '',
    };
    const enriched = await this.#enrich(metadata);
    const { session, replaced } = this.sessions.create({
      userId,
      chatId,
      filePath,
      originalFilename,
      metadata: enriched,
      hasCover: embedded.hasCover,
    });
    if (replaced) await this.cleanupPayload(replaced);
    return session;
  }

  async setArtistAndTitle(session, metadata) {
    session.metadata = await this.#enrich({ ...session.metadata, ...metadata });
    return session;
  }

  setAlbum(session, album) {
    session.metadata.album = String(album || '').trim();
    return session;
  }

  async complete(session) {
    let writable;
    try {
      writable = await prepareWritableAudio(session.filePath, {
        tempDir: this.config.tempDir,
        hasNewCover: Boolean(session.coverPath),
      });
      session.filePath = writable.filePath;

      const taggedFile = await writeAudioMetadata(session.filePath, session.metadata, {
        tempDir: this.config.tempDir,
        coverPath: session.coverPath,
      });
      session.filePath = taggedFile;

      const filename = `${safeFilenamePart(session.metadata.artist)} - ${safeFilenamePart(session.metadata.title)}${writable.extension}`;
      const destination = await findAvailablePath(this.config.musicDir, filename);
      await moveFile(taggedFile, destination);
      session.filePath = null;
      await removeIfExists(session.coverPath);
      session.coverPath = null;
      this.sessions.delete(session.userId);
      return { destination, converted: writable.converted };
    } catch (error) {
      await this.cancel(session.userId);
      throw error;
    }
  }

  async cancel(userId) {
    const session = this.sessions.delete(userId);
    await this.cleanupPayload(session);
    return session;
  }

  async cleanupPayload(session) {
    if (!session) return;
    await Promise.all([
      removeIfExists(session.filePath),
      removeIfExists(session.coverPath),
    ]);
  }

  async #enrich(metadata) {
    if (!metadata.artist || !metadata.title) return metadata;
    const found = await this.metadataService.findRecording(metadata.artist, metadata.title);
    return mergeMetadata(metadata, found);
  }
}
