import crypto from 'node:crypto';

export class SearchStore {
  #items = new Map();

  constructor({ ttlMs, now = () => Date.now() }) { this.ttlMs = ttlMs; this.now = now; }

  create({ userId, tracks, coverUrl }) {
    this.prune();
    const id = crypto.randomBytes(12).toString('base64url');
    const item = { id, userId: String(userId), tracks: [...tracks], coverUrl, expiresAt: this.now() + this.ttlMs };
    this.#items.set(id, item);
    return item;
  }

  get(id, userId) {
    const item = this.#items.get(id);
    if (!item || item.expiresAt <= this.now()) { this.#items.delete(id); return null; }
    return item.userId === String(userId) ? item : null;
  }

  delete(id) { this.#items.delete(id); }

  prune() {
    for (const [id, item] of this.#items) if (item.expiresAt <= this.now()) this.#items.delete(id);
  }
}
