import test from 'node:test';
import assert from 'node:assert/strict';
import { searchProviders } from '../src/services/provider-search.js';

test('combines provider results even when another provider fails', async () => {
  const result = await searchProviders([
    { name: 'skysound', search: async () => [{ source: 'skysound', title: 'Found' }] },
    { name: 'youtube', search: async () => { throw new Error('unavailable'); } },
  ], 'query');

  assert.deepEqual(result.tracks, [{ source: 'skysound', title: 'Found' }]);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].provider, 'youtube');
});
