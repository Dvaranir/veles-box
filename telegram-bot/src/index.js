import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createConfig } from './config.js';
import { ensureDirectories } from './infrastructure/files.js';
import { SkySoundProvider } from './providers/skysound-provider.js';
import { YouTubeProvider } from './providers/youtube-provider.js';
import { MusicBrainzService } from './services/musicbrainz.js';
import { SearchSessionStore } from './services/search-sessions.js';
import { IngestionSessionStore } from './services/ingestion-sessions.js';
import { IngestionService } from './services/ingestion.js';
import { TrackDownloadService } from './services/track-downloads.js';
import { createBot } from './bot/create-bot.js';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(sourceDirectory, '../../.env') });
dotenv.config();

const config = createConfig();
await ensureDirectories(config.musicDir, config.tempDir);

const providers = [
  new SkySoundProvider({ timeoutMs: config.downloadTimeoutMs }),
  new YouTubeProvider({
    ytDlpPath: config.ytDlpPath,
    tempDir: config.tempDir,
    timeoutMs: config.downloadTimeoutMs,
    searchLimit: config.youtubeSearchLimit,
  }),
];
const ingestionSessions = new IngestionSessionStore();
const ingestionService = new IngestionService({
  sessions: ingestionSessions,
  metadataService: new MusicBrainzService({
    timeoutMs: config.downloadTimeoutMs,
    userAgent: config.musicBrainzUserAgent,
  }),
  config,
});

const bot = createBot({
  config,
  providers,
  searchSessions: new SearchSessionStore({ ttlMs: config.searchSessionTtlMs }),
  ingestionService,
  ingestionSessions,
  downloadService: new TrackDownloadService({
    providers,
    tempDir: config.tempDir,
    timeoutMs: config.downloadTimeoutMs,
  }),
});

console.info('Veles bot is starting…');
bot.start();
