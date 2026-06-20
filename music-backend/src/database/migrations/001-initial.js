// The seeded password is stored only as a bcrypt hash. No plaintext secret is committed.
export const name = '001-initial';

export async function up({ sequelize, User, Session }) {
  await sequelize.getQueryInterface().createTable('users', {
    id: { type: 'INTEGER', primaryKey: true, autoIncrement: true, allowNull: false },
    username: { type: 'VARCHAR(64)', allowNull: false, unique: true },
    password_hash: { type: 'VARCHAR(100)', allowNull: false },
    created_at: { type: 'DATETIME', allowNull: false },
    updated_at: { type: 'DATETIME', allowNull: false },
  });
  await sequelize.getQueryInterface().createTable('sessions', {
    id: { type: 'INTEGER', primaryKey: true, autoIncrement: true, allowNull: false },
    token_hash: { type: 'VARCHAR(64)', allowNull: false, unique: true },
    expires_at: { type: 'DATETIME', allowNull: false },
    last_used_at: { type: 'DATETIME', allowNull: false },
    user_id: { type: 'INTEGER', allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    created_at: { type: 'DATETIME', allowNull: false },
    updated_at: { type: 'DATETIME', allowNull: false },
  });
  await sequelize.getQueryInterface().addIndex('sessions', ['token_hash'], { unique: true });
  await User.create({
    username: 'Dvaranir',
    passwordHash: '$2a$12$FEOGn3NvbVVuv/b9M/Sq3e523bIoJZPnXXKI0/.GeZEC6V2e25ZTu',
  });
  await Session.destroy({ where: {} });
}
