import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfig } from '../src/config.js';

test('accepts legacy Telegram token name and applies search defaults', () => {
  const config = createConfig({
    TELEGRAM_BOT_TOKEN: 'token',
    TELEGRAM_USERS_WHITELIST: ' 1,2 ',
    PIXELDRAIN_TOKEN: 'pixel-token',
  });
  assert.equal(config.telegramToken, 'token');
  assert.deepEqual([...config.allowedUserIds], ['1', '2']);
  assert.equal(config.searchPageSize, 10);
});

test('rejects missing required configuration', () => {
  assert.throws(
    () => createConfig({ TELEGRAM_TOKEN: 'token', PIXELDRAIN_TOKEN: 'pixel-token' }),
    /TELEGRAM_USERS_WHITELIST is required/,
  );
});
