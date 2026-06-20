import path from 'node:path';

const DEFAULT_PAGE_SIZE = 10;

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function createConfig(env = process.env) {
  const token = env.TELEGRAM_TOKEN?.trim() || env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error('TELEGRAM_TOKEN or TELEGRAM_BOT_TOKEN is required');
  }

  const whitelist = required(env, 'TELEGRAM_USERS_WHITELIST')
    .split(',')
    .map((userId) => userId.trim())
    .filter(Boolean);

  if (whitelist.length === 0) {
    throw new Error('TELEGRAM_USERS_WHITELIST must contain at least one user id');
  }

  return Object.freeze({
    telegramToken: token,
    allowedUserIds: new Set(whitelist),
    musicDir: path.resolve(env.MUSIC_DIR || '/bot/music'),
    tempDir: path.resolve(env.TEMP_DIR || '/bot/temp'),
    searchPageSize: positiveInteger(env.SEARCH_PAGE_SIZE, DEFAULT_PAGE_SIZE, 'SEARCH_PAGE_SIZE'),
    searchSessionTtlMs: positiveInteger(
      env.SEARCH_SESSION_TTL_MINUTES,
      30,
      'SEARCH_SESSION_TTL_MINUTES',
    ) * 60_000,
    downloadTimeoutMs: positiveInteger(env.DOWNLOAD_TIMEOUT_MS, 120_000, 'DOWNLOAD_TIMEOUT_MS'),
    youtubeSearchLimit: positiveInteger(env.YOUTUBE_SEARCH_LIMIT, 50, 'YOUTUBE_SEARCH_LIMIT'),
    ytDlpPath: env.YTDLP_PATH || 'yt-dlp',
    musicBrainzUserAgent: env.MUSICBRAINZ_USER_AGENT || 'veles-box-telegram-bot/1.0',
    pixelDrainToken: required(env, 'PIXELDRAIN_TOKEN'),
  });
}
