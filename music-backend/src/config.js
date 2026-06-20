import path from 'node:path';

function positiveInteger(value, fallback, key) {
  const parsed = Number.parseInt(value ?? fallback, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${key} must be a positive integer`);
  return parsed;
}

export function createConfig(env = process.env) {
  return Object.freeze({
    host: env.MUSIC_BACKEND_HOST || '0.0.0.0',
    port: positiveInteger(env.MUSIC_BACKEND_PORT, 80, 'MUSIC_BACKEND_PORT'),
    publicHost: env.MUSIC_BACKEND_PUBLIC_HOST || 'music-backend.dvaranir.com',
    databasePath: path.resolve(env.MUSIC_BACKEND_DATABASE || '/app/data/music-backend.sqlite'),
    musicDir: path.resolve(env.MUSIC_DIR || '/app/music'),
    tempDir: path.resolve(env.TEMP_DIR || '/app/temp'),
    downloadTimeoutMs: positiveInteger(env.DOWNLOAD_TIMEOUT_MS, 120_000, 'DOWNLOAD_TIMEOUT_MS'),
    searchTtlMs: positiveInteger(env.SEARCH_SESSION_TTL_MINUTES, 30, 'SEARCH_SESSION_TTL_MINUTES') * 60_000,
    jobTtlMs: positiveInteger(env.JOB_TTL_MINUTES, 60, 'JOB_TTL_MINUTES') * 60_000,
    sessionTtlMs: positiveInteger(env.SESSION_TTL_DAYS, 30, 'SESSION_TTL_DAYS') * 86_400_000,
    youtubeSearchLimit: positiveInteger(env.YOUTUBE_SEARCH_LIMIT, 50, 'YOUTUBE_SEARCH_LIMIT'),
    ytDlpPath: env.YTDLP_PATH || 'yt-dlp',
    musicBrainzUserAgent: env.MUSICBRAINZ_USER_AGENT || 'veles-music-backend/1.0',
    maxCoverBytes: positiveInteger(env.MAX_COVER_BYTES, 10 * 1024 * 1024, 'MAX_COVER_BYTES'),
  });
}
