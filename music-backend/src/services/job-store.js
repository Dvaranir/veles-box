import crypto from 'node:crypto';
import { removeIfExists } from '@veles/music-core/infrastructure/files';

export class JobStore {
  #jobs = new Map();

  constructor({ ttlMs, now = () => Date.now() }) { this.ttlMs = ttlMs; this.now = now; }

  create({ userId, track, coverUrl }) {
    const job = {
      id: crypto.randomBytes(12).toString('base64url'), userId: String(userId), track, coverUrl,
      status: 'processing', createdAt: this.now(), expiresAt: this.now() + this.ttlMs,
      metadata: null, filePath: null, error: null,
    };
    this.#jobs.set(job.id, job);
    return job;
  }

  get(id, userId) {
    const job = this.#jobs.get(id);
    return job && job.userId === String(userId) ? job : null;
  }

  async cancel(id, userId) {
    const job = this.get(id, userId);
    if (!job) return false;
    job.status = 'cancelled';
    this.#jobs.delete(id);
    await removeIfExists(job.filePath);
    return true;
  }

  async prune() {
    for (const [id, job] of this.#jobs) {
      if (job.expiresAt > this.now()) continue;
      this.#jobs.delete(id);
      await removeIfExists(job.filePath);
    }
  }
}
