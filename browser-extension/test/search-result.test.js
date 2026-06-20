import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSearchResult } from '../src/lib/search-result.js';

test('formats duration and bitrate in a search result', () => {
  assert.equal(
    formatSearchResult({ source: 'skysound', artist: 'Artist', title: 'Title', duration: '3:09', bitrate: 128 }),
    'SkySound · 3:09 · 128 кбит/с: Artist — Title',
  );
});

test('omits duration and bitrate when a provider did not return them', () => {
  assert.equal(
    formatSearchResult({ source: 'youtube', artist: 'Artist', title: 'Title', duration: '', bitrate: undefined }),
    'YouTube: Artist — Title',
  );
});
