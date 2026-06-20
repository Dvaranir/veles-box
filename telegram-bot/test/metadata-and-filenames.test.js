import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mergeMetadata, splitArtistTitle } from '../src/domain/tracks.js';
import { inferMetadataFromFilename, prepareWritableAudio } from '../src/services/audio-metadata.js';
import { findAvailablePath, safeFilenamePart } from '../src/infrastructure/files.js';

test('infers artist and title from a filename without splitting title hyphens', () => {
  assert.deepEqual(inferMetadataFromFilename('Artist - Long - Title.mp3'), {
    artist: 'Artist', title: 'Long - Title', album: '',
  });
  assert.deepEqual(splitArtistTitle('Artist - Long - Title'), {
    artist: 'Artist', title: 'Long - Title',
  });
});

test('keeps source metadata when MusicBrainz has no value and fills album when available', () => {
  assert.deepEqual(
    mergeMetadata(
      { artist: 'Source Artist', title: 'Source Title', album: '' },
      { artist: '', title: '', album: 'Found Album' },
    ),
    { artist: 'Source Artist', title: 'Source Title', album: 'Found Album' },
  );
});

test('sanitizes output filename parts and finds a collision-free path', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'veles-filenames-'));
  try {
    assert.equal(safeFilenamePart('A/B: C'), 'A_B_ C');
    await fs.writeFile(path.join(directory, 'Artist - Title.mp3'), 'x');
    const available = await findAvailablePath(directory, 'Artist - Title.mp3');
    assert.equal(path.basename(available), 'Artist - Title (1).mp3');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('uses FFmpeg conversion for WebM when tags must be written', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'veles-audio-'));
  const source = path.join(directory, 'track.webm');
  await fs.writeFile(source, 'not really audio');
  const calls = [];
  try {
    const result = await prepareWritableAudio(source, {
      tempDir: directory,
      commandRunner: async (...args) => { calls.push(args); return { stdout: '', stderr: '' }; },
    });
    assert.equal(result.extension, '.mp3');
    assert.equal(result.converted, true);
    assert.equal(calls[0][0], 'ffmpeg');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
