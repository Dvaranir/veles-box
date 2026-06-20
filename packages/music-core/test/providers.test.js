import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSkySoundDownloadUrl, parseSkySoundSearch, skySoundSearchUrl } from '../src/providers/skysound-provider.js';
import { searchProviders } from '../src/services/provider-search.js';

test('parses SkySound cards and dedicated download links', () => {
  const tracks = parseSkySoundSearch('<li class="__adv_list_track"><a class="playlist-down no-ajax" href="/t/1"></a><span class="__adv_artist">Artist</span><span class="__adv_name">Title</span><span class="__adv_duration">3:00</span></li>');
  assert.equal(tracks[0].artist, 'Artist');
  assert.equal(tracks[0].title, 'Title');
  assert.match(skySoundSearchUrl('Вежливый Мордобой'), /skysound7\.com/);
  assert.equal(parseSkySoundDownloadUrl('<a class="onesongblock-down __adv_download" href="https://cdn.test/a.mp3"></a>'), 'https://cdn.test/a.mp3');
});

test('keeps successful provider results when another provider fails', async () => {
  const result = await searchProviders([
    { name: 'one', search: async () => [{ title: 'track' }] },
    { name: 'two', search: async () => { throw new Error('down'); } },
  ], 'query');
  assert.equal(result.tracks.length, 1);
  assert.equal(result.failures[0].provider, 'two');
});
