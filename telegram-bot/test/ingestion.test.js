import test from 'node:test';
import assert from 'node:assert/strict';
import { IngestionService } from '../src/services/ingestion.js';
import { IngestionSessionStore } from '../src/services/ingestion-sessions.js';

test('requests artist/title only when automatic sources cannot supply them', async () => {
  const sessions = new IngestionSessionStore();
  const service = new IngestionService({
    sessions,
    metadataService: { findRecording: async () => null },
    config: { tempDir: '/tmp', musicDir: '/tmp' },
  });

  const session = await service.start({
    userId: '1', chatId: '1', filePath: '/not-a-real-file.mp3', originalFilename: 'unknown.mp3',
  });
  assert.equal(session.metadata.artist, '');
  assert.equal(session.metadata.title, '');
  await service.cancel('1');
});

test('uses provider metadata and enriches it with a MusicBrainz album', async () => {
  const sessions = new IngestionSessionStore();
  const service = new IngestionService({
    sessions,
    metadataService: {
      findRecording: async () => ({ artist: 'Canonical Artist', title: 'Canonical Title', album: 'Album' }),
    },
    config: { tempDir: '/tmp', musicDir: '/tmp' },
  });

  const session = await service.start({
    userId: '1', chatId: '1', filePath: '/not-a-real-file.mp3', originalFilename: 'source.mp3',
    seedMetadata: { artist: 'Artist', title: 'Title' },
  });
  assert.deepEqual(session.metadata, {
    artist: 'Canonical Artist', title: 'Canonical Title', album: 'Album',
  });
  await service.cancel('1');
});
