import * as initial from './migrations/001-initial.js';

const migrations = [initial];

export async function migrate(database) {
  const { Migration, sequelize } = database;
  await sequelize.getQueryInterface().createTable('schema_migrations', {
    name: { type: 'VARCHAR(128)', primaryKey: true, allowNull: false },
    created_at: { type: 'DATETIME', allowNull: false },
  }).catch((error) => {
    if (!/already exists/i.test(error.message)) throw error;
  });
  for (const migration of migrations) {
    const applied = await Migration.findByPk(migration.name);
    if (applied) continue;
    await sequelize.transaction(async () => {
      await migration.up(database);
      await Migration.create({ name: migration.name });
    });
  }
}
