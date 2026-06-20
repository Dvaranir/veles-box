import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  constructor({ User, Session, sessionTtlMs }) { Object.assign(this, { User, Session, sessionTtlMs }); }

  async login(username, password) {
    const user = await this.User.findOne({ where: { username } });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) return null;
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);
    await this.Session.create({ userId: user.id, tokenHash: hashToken(token), expiresAt, lastUsedAt: new Date() });
    return { token, expiresAt, user: { id: user.id, username: user.username } };
  }

  async authenticate(token) {
    if (!token) return null;
    const session = await this.Session.findOne({
      where: { tokenHash: hashToken(token) },
      include: [{ model: this.User, attributes: ['id', 'username'] }],
    });
    if (!session) return null;
    if (session.expiresAt <= new Date()) {
      await session.destroy();
      return null;
    }
    await session.update({ lastUsedAt: new Date() });
    return { sessionId: session.id, user: { id: session.User.id, username: session.User.username } };
  }

  async logout(token) {
    if (token) await this.Session.destroy({ where: { tokenHash: hashToken(token) } });
  }
}
