import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { ensureDirectories } from '@veles/music-core/infrastructure/files';
import { SkySoundProvider } from '@veles/music-core/providers/skysound';
import { YouTubeProvider } from '@veles/music-core/providers/youtube';
import { TrackDownloadService } from '@veles/music-core/services/downloads';
import { MusicBrainzService } from '@veles/music-core/services/musicbrainz';
import { createConfig } from './config.js';
import { createDatabase } from './database/models.js';
import { migrate } from './database/migrate.js';
import { AuthService } from './services/auth-service.js';
import { SearchStore } from './services/search-store.js';
import { JobStore } from './services/job-store.js';
import { CoverService } from './services/cover-service.js';
import { JobService } from './services/job-service.js';
import { createApp } from './app.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });
const config = createConfig();
await ensureDirectories(config.musicDir, config.tempDir, path.dirname(config.databasePath));
const database = createDatabase(config.databasePath);
await database.sequelize.authenticate();
await migrate(database);

const providers = [
  new SkySoundProvider({ timeoutMs: config.downloadTimeoutMs }),
  new YouTubeProvider({ ytDlpPath: config.ytDlpPath, tempDir: config.tempDir, timeoutMs: config.downloadTimeoutMs, searchLimit: config.youtubeSearchLimit }),
];
const jobs = new JobStore({ ttlMs: config.jobTtlMs });
const app = createApp({
  config,
  auth: new AuthService({ ...database, sessionTtlMs: config.sessionTtlMs }),
  providers,
  searchStore: new SearchStore({ ttlMs: config.searchTtlMs }),
  jobs,
  jobService: new JobService({
    jobs,
    downloads: new TrackDownloadService({ providers, tempDir: config.tempDir, timeoutMs: config.downloadTimeoutMs }),
    musicBrainz: new MusicBrainzService({ timeoutMs: config.downloadTimeoutMs, userAgent: config.musicBrainzUserAgent }),
    covers: new CoverService({ tempDir: config.tempDir, maxBytes: config.maxCoverBytes, timeoutMs: config.downloadTimeoutMs }),
    config,
  }),
});
setInterval(() => { void jobs.prune(); }, 60_000).unref();
const server = app.listen(config.port, config.host, () => console.info(`Music backend listening on ${config.host}:${config.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { server.close(); await database.sequelize.close(); process.exit(0); });
