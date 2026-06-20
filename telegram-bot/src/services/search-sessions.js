import crypto from 'node:crypto';

const CALLBACK_PREFIX = 's';

export class SearchSessionStore {
  #sessions = new Map();

  constructor({ ttlMs, now = () => Date.now() }) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  create({ userId, chatId, tracks }) {
    this.prune();
    const id = crypto.randomBytes(6).toString('base64url');
    const session = {
      id,
      userId: String(userId),
      chatId: String(chatId),
      tracks: [...tracks],
      expiresAt: this.now() + this.ttlMs,
    };
    this.#sessions.set(id, session);
    return session;
  }

  get(id, userId) {
    const session = this.#sessions.get(id);
    if (!session || session.expiresAt <= this.now()) {
      this.#sessions.delete(id);
      return null;
    }
    return session.userId === String(userId) ? session : null;
  }

  delete(id) {
    this.#sessions.delete(id);
  }

  prune() {
    for (const [id, session] of this.#sessions) {
      if (session.expiresAt <= this.now()) this.#sessions.delete(id);
    }
  }
}

export function searchPageCallback(sessionId, page) {
  return `${CALLBACK_PREFIX}:p:${sessionId}:${page}`;
}

export function searchSelectCallback(sessionId, index) {
  return `${CALLBACK_PREFIX}:t:${sessionId}:${index}`;
}

export function searchCancelCallback(sessionId) {
  return `${CALLBACK_PREFIX}:c:${sessionId}`;
}

export function parseSearchCallback(data) {
  const parts = String(data || '').split(':');
  if (parts[0] !== CALLBACK_PREFIX) return null;

  if (parts[1] === 'c' && parts.length === 3) {
    return { action: 'cancel', sessionId: parts[2] };
  }
  if ((parts[1] === 'p' || parts[1] === 't') && parts.length === 4) {
    const value = Number.parseInt(parts[3], 10);
    if (!Number.isInteger(value) || value < 0) return null;
    return {
      action: parts[1] === 'p' ? 'page' : 'select',
      sessionId: parts[2],
      value,
    };
  }
  return null;
}
