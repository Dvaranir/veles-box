import crypto from 'node:crypto';

export class IngestionSessionStore {
  #sessions = new Map();

  create({ userId, chatId, filePath, originalFilename, metadata, hasCover }) {
    const existing = this.getByUser(userId);
    const session = {
      id: crypto.randomBytes(6).toString('base64url'),
      userId: String(userId),
      chatId: String(chatId),
      filePath,
      originalFilename,
      metadata: { ...metadata },
      hasCover,
      coverPath: null,
      stage: 'metadata',
    };
    this.#sessions.set(session.userId, session);
    return { session, replaced: existing };
  }

  getByUser(userId) {
    return this.#sessions.get(String(userId)) || null;
  }

  get(id, userId) {
    const session = this.getByUser(userId);
    return session?.id === id ? session : null;
  }

  delete(userId) {
    const key = String(userId);
    const session = this.#sessions.get(key) || null;
    this.#sessions.delete(key);
    return session;
  }
}

export function ingestionCallback(sessionId, field, action) {
  return `m:${sessionId}:${field}:${action}`;
}

export function parseIngestionCallback(data) {
  const parts = String(data || '').split(':');
  if (parts[0] !== 'm' || parts.length !== 4) return null;
  return { sessionId: parts[1], field: parts[2], action: parts[3] };
}
