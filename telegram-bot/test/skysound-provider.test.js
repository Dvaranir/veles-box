import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSkySoundDownloadUrl,
  parseSkySoundSearch,
  skySoundSearchUrl,
} from '../src/providers/skysound-provider.js';

const SEARCH_HTML = `
<ul>
  <li class="__adv_list_track">
    <a class="playlist-down no-ajax" href="/t/example/">download</a>
    <span class="playlist-name-artist"><a class="__adv_artist">Artist One</a></span>
    <span class="playlist-name-title"><a class="__adv_name"><em>Track One</em></a></span>
    <span class="playlist-duration __adv_duration">3:42</span>
  </li>
  <li class="__adv_list_track">
    <a class="playlist-down no-ajax" href="https://skysound7.com/t/second/">download</a>
    <span class="__adv_artist">Artist Two</span>
    <span class="__adv_name">Track Two</span>
  </li>
</ul>`;

test('builds a SkySound subdomain URL from a Cyrillic search query', () => {
  const url = new URL(skySoundSearchUrl('  Вежливый   Мордобой '));
  assert.equal(url.protocol, 'https:');
  assert.match(url.hostname, /\.skysound7\.com$/);
  assert.equal(url.pathname, '/');
});

test('parses all distinct SkySound search tracks', () => {
  const tracks = parseSkySoundSearch(SEARCH_HTML);
  assert.equal(tracks.length, 2);
  assert.deepEqual(
    tracks.map(({ source, artist, title, duration, detailUrl }) => ({ source, artist, title, duration, detailUrl })),
    [
      {
        source: 'skysound',
        artist: 'Artist One',
        title: 'Track One',
        duration: '3:42',
        detailUrl: 'https://skysound7.com/t/example/',
      },
      {
        source: 'skysound',
        artist: 'Artist Two',
        title: 'Track Two',
        duration: '',
        detailUrl: 'https://skysound7.com/t/second/',
      },
    ],
  );
});

test('parses the dedicated SkySound download link', () => {
  assert.equal(
    parseSkySoundDownloadUrl('<a class="onesongblock-down no-ajax __adv_download" href="https://cdn.example/song.mp3">Download</a>'),
    'https://cdn.example/song.mp3',
  );
});
