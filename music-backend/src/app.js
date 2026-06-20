import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { normalizeYandexCoverUrl } from './services/yandex-cover-url.js';

const loginSchema = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) });
const searchSchema = z.object({
  artist: z.string().trim().min(1).max(256),
  title: z.string().trim().min(1).max(256),
  coverUrl: z.string().url().max(2048).nullable().optional(),
});
const jobSchema = z.object({ resultIndex: z.number().int().nonnegative() });
const finalizeSchema = z.object({
  artist: z.string().trim().min(1).max(256).optional(),
  title: z.string().trim().min(1).max(256).optional(),
  albumAction: z.enum(['keep', 'set', 'skip']).default('keep'),
  album: z.string().trim().max(256).optional(),
  coverAction: z.enum(['yandex', 'upload', 'skip']).default('skip'),
});

function bearerToken(request) {
  const value = request.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : null;
}

function resultView(track, index) {
  return { index, source: track.source, artist: track.artist, title: track.title, duration: track.duration, bitrate: track.bitrate };
}

function jobView(job) {
  return {
    id: job.id,
    status: job.status,
    error: job.error || undefined,
    metadata: job.status === 'awaiting_metadata' ? job.metadata : undefined,
    cover: job.status === 'awaiting_metadata' ? { yandexAvailable: Boolean(job.coverUrl), embedded: Boolean(job.hasEmbeddedCover) } : undefined,
    filename: job.status === 'completed' ? job.destination?.split('/').at(-1) : undefined,
  };
}

export function createApp({ config, auth, providers, searchStore, jobs, jobService, logger = console }) {
  const app = express();
  const upload = multer({ dest: config.tempDir, limits: { fileSize: config.maxCoverBytes, files: 1 } });

  app.disable('x-powered-by');
  app.use((request, response, next) => {
    const host = (request.hostname || '').toLowerCase();
    const localTestHost = process.env.NODE_ENV === 'test' && ['127.0.0.1', 'localhost'].includes(host);
    if (host && host !== config.publicHost && !localTestHost) return response.status(421).json({ error: 'Misdirected request' });
    return next();
  });
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || /^(moz-extension|chrome-extension):\/\//.test(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed'));
    },
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  }));
  app.use(express.json({ limit: '64kb' }));

  const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
  const apiLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });
  const requireAuth = async (request, response, next) => {
    const identity = await auth.authenticate(bearerToken(request));
    if (!identity) return response.status(401).json({ error: 'Authentication required' });
    request.identity = identity;
    return next();
  };

  app.get('/health', (_request, response) => response.json({ ok: true }));

  app.post('/api/v1/auth/login', loginLimiter, async (request, response, next) => {
    try {
      const { username, password } = loginSchema.parse(request.body);
      const session = await auth.login(username, password);
      if (!session) return response.status(401).json({ error: 'Invalid username or password' });
      return response.status(201).json({ token: session.token, expiresAt: session.expiresAt, user: session.user });
    } catch (error) { return next(error); }
  });
  app.post('/api/v1/auth/logout', requireAuth, async (request, response) => {
    await auth.logout(bearerToken(request));
    return response.status(204).end();
  });
  app.get('/api/v1/auth/me', requireAuth, (request, response) => response.json({ user: request.identity.user }));

  app.post('/api/v1/searches', apiLimiter, requireAuth, async (request, response, next) => {
    try {
      const input = searchSchema.parse(request.body);
      const coverUrl = input.coverUrl ? normalizeYandexCoverUrl(input.coverUrl) : undefined;
      const query = `${input.artist} - ${input.title}`;
      const settled = await Promise.allSettled(providers.map((provider) => provider.search(query)));
      const tracks = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
      const failures = settled.flatMap((result, index) => result.status === 'rejected' ? [providers[index].name] : []);
      const search = searchStore.create({ userId: request.identity.user.id, tracks, coverUrl });
      return response.status(201).json({
        id: search.id,
        results: tracks.map(resultView),
        failedProviders: failures,
        expiresAt: new Date(search.expiresAt).toISOString(),
      });
    } catch (error) { return next(error); }
  });

  app.post('/api/v1/searches/:searchId/jobs', apiLimiter, requireAuth, async (request, response, next) => {
    try {
      const { resultIndex } = jobSchema.parse(request.body);
      const search = searchStore.get(request.params.searchId, request.identity.user.id);
      if (!search) return response.status(404).json({ error: 'Search session was not found or expired' });
      const track = search.tracks[resultIndex];
      if (!track) return response.status(404).json({ error: 'Search result was not found' });
      const job = jobService.create({ userId: request.identity.user.id, track, coverUrl: search.coverUrl });
      return response.status(202).json(jobView(job));
    } catch (error) { return next(error); }
  });

  app.get('/api/v1/jobs/:jobId', apiLimiter, requireAuth, (request, response) => {
    const job = jobs.get(request.params.jobId, request.identity.user.id);
    if (!job) return response.status(404).json({ error: 'Job was not found or expired' });
    return response.json(jobView(job));
  });

  app.post('/api/v1/jobs/:jobId/finalize', apiLimiter, requireAuth, upload.single('cover'), async (request, response, next) => {
    try {
      const job = jobs.get(request.params.jobId, request.identity.user.id);
      if (!job) return response.status(404).json({ error: 'Job was not found or expired' });
      const input = finalizeSchema.parse(request.body);
      if (input.coverAction === 'upload' && !request.file) return response.status(400).json({ error: 'Cover upload is required' });
      const result = await jobService.finalize(job, { ...input, coverFilePath: request.file?.path });
      return response.status(201).json({ status: 'completed', filename: result.destination.split('/').at(-1), converted: result.converted });
    } catch (error) {
      await import('node:fs/promises').then(({ rm }) => request.file?.path ? rm(request.file.path, { force: true }) : undefined);
      return next(error);
    }
  });

  app.delete('/api/v1/jobs/:jobId', apiLimiter, requireAuth, async (request, response) => {
    if (!await jobs.cancel(request.params.jobId, request.identity.user.id)) return response.status(404).json({ error: 'Job was not found or expired' });
    return response.status(204).end();
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof z.ZodError) return response.status(400).json({ error: 'Invalid request', details: error.issues.map(({ path, message }) => ({ path, message })) });
    if (error.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error: 'Cover exceeds the size limit' });
    if (error.message === 'Origin is not allowed') return response.status(403).json({ error: error.message });
    logger.error('API request failed', { message: error.message });
    return response.status(500).json({ error: 'Request processing failed' });
  });

  return app;
}
