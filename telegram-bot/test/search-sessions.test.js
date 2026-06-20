import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrack } from '../src/domain/tracks.js';
import {
  parseSearchCallback,
  SearchSessionStore,
  searchCancelCallback,
  searchPageCallback,
  searchSelectCallback,
} from '../src/services/search-sessions.js';
import { createSearchPage } from '../src/bot/search-view.js';

function tracks(count) {
  return Array.from({ length: count }, (_, index) => createTrack({
    source: index % 2 ? 'youtube' : 'skysound',
    artist: `Artist ${index}`,
    title: `Title ${index}`,
    bitrate: index % 2 ? 128 : undefined,
  }));
}

test('encodes and decodes compact search callbacks', () => {
  assert.deepEqual(parseSearchCallback(searchPageCallback('abcdef', 3)), {
    action: 'page', sessionId: 'abcdef', value: 3,
  });
  assert.deepEqual(parseSearchCallback(searchSelectCallback('abcdef', 12)), {
    action: 'select', sessionId: 'abcdef', value: 12,
  });
  assert.deepEqual(parseSearchCallback(searchCancelCallback('abcdef')), {
    action: 'cancel', sessionId: 'abcdef',
  });
  assert.equal(parseSearchCallback('not:a:callback'), null);
});

test('keeps sessions private to the original user and expires them', () => {
  let now = 100;
  const store = new SearchSessionStore({ ttlMs: 50, now: () => now });
  const session = store.create({ userId: 1, chatId: 1, tracks: tracks(1) });
  assert.equal(store.get(session.id, 2), null);
  assert.equal(store.get(session.id, 1), session);
  now = 151;
  assert.equal(store.get(session.id, 1), null);
});

test('renders a paginated keyboard with result callbacks', () => {
  const store = new SearchSessionStore({ ttlMs: 60_000 });
  const session = store.create({ userId: 1, chatId: 1, tracks: tracks(12) });
  const view = createSearchPage(session, 1, 10);
  assert.match(view.text, /Страница 2\/2/);
  assert.match(JSON.stringify(view.replyMarkup.inline_keyboard), /s:t:/);
  assert.match(JSON.stringify(view.replyMarkup.inline_keyboard), /s:p:/);
});
