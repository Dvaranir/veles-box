import { DataTypes, Sequelize } from 'sequelize';

export function createDatabase(storage) {
  const sequelize = new Sequelize({ dialect: 'sqlite', storage, logging: false });
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(100), allowNull: false },
  }, { tableName: 'users', underscored: true });
  const Session = sequelize.define('Session', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    lastUsedAt: { type: DataTypes.DATE, allowNull: false },
  }, { tableName: 'sessions', underscored: true });
  const Migration = sequelize.define('Migration', {
    name: { type: DataTypes.STRING(128), primaryKey: true },
  }, { tableName: 'schema_migrations', timestamps: true, updatedAt: false, underscored: true });
  User.hasMany(Session, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
  Session.belongsTo(User, { foreignKey: { name: 'userId', allowNull: false } });
  return { sequelize, User, Session, Migration };
}
