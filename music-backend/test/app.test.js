import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { SearchStore } from '../src/services/search-store.js';
import { JobStore } from '../src/services/job-store.js';

test('creates the protected Express application with its API dependencies', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'veles-api-'));
  try {
    const jobs = new JobStore({ ttlMs: 60_000 });
    const app = createApp({
      config: { publicHost: 'music-backend.dvaranir.com', tempDir, maxCoverBytes: 1024 * 1024 },
      auth: { authenticate: async () => null, login: async () => null, logout: async () => {} },
      providers: [{ name: 'skysound', search: async () => [] }],
      searchStore: new SearchStore({ ttlMs: 60_000 }), jobs,
      jobService: { create: ({ userId, track, coverUrl }) => jobs.create({ userId, track, coverUrl }) },
      logger: { error: () => {} },
    });
    assert.equal(typeof app, 'function');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('keeps search sessions and jobs bound to their owner', () => {
  const searches = new SearchStore({ ttlMs: 60_000 });
  const search = searches.create({ userId: 1, tracks: [{ source: 'skysound', artist: 'A', title: 'B' }] });
  assert.ok(searches.get(search.id, 1));
  assert.equal(searches.get(search.id, 2), null);

  const jobs = new JobStore({ ttlMs: 60_000 });
  const job = jobs.create({ userId: 1, track: search.tracks[0] });
  assert.ok(jobs.get(job.id, 1));
  assert.equal(jobs.get(job.id, 2), null);
});
