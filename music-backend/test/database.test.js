import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { createDatabase } from '../src/database/models.js';
import { migrate } from '../src/database/migrate.js';
import { AuthService } from '../src/services/auth-service.js';

async function temporaryDatabase() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'veles-backend-'));
  const database = createDatabase(path.join(directory, 'database.sqlite'));
  await database.sequelize.authenticate();
  await migrate(database);
  return { directory, database };
}

test('runs the initial migration and seeds one bcrypt-protected user', async () => {
  const { directory, database } = await temporaryDatabase();
  try {
    const user = await database.User.findOne({ where: { username: 'Dvaranir' } });
    assert.ok(user);
    assert.equal(bcrypt.getRounds(user.passwordHash), 12);
    assert.notEqual(user.passwordHash.includes('Region'), true);
  } finally {
    await database.sequelize.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('issues, authenticates, and revokes opaque session tokens', async () => {
  const { directory, database } = await temporaryDatabase();
  try {
    const passwordHash = await bcrypt.hash('test-password', 10);
    await database.User.create({ username: 'test-user', passwordHash });
    const auth = new AuthService({ ...database, sessionTtlMs: 60_000 });
    const login = await auth.login('test-user', 'test-password');
    assert.ok(login?.token);
    assert.equal((await auth.authenticate(login.token)).user.username, 'test-user');
    await auth.logout(login.token);
    assert.equal(await auth.authenticate(login.token), null);
  } finally {
    await database.sequelize.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
