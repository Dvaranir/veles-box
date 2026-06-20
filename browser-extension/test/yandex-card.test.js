import test from 'node:test';
import assert from 'node:assert/strict';
import { highResolutionCoverUrl } from '../src/lib/yandex-card.js';

test('upgrades a Yandex cover URL to 1000px', () => {
  assert.equal(
    highResolutionCoverUrl('https://avatars.yandex.net/get-music-content/1/a/100x100'),
    'https://avatars.yandex.net/get-music-content/1/a/1000x1000',
  );
});
