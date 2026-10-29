const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const config = require('../config');
const { User, RefreshToken } = require('../models');
const { AppError } = require('../middleware/error');

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;
// Compared against when the account does not exist, so login timing doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function publicUser(user) {
  return { id: user.id, username: user.username, email: user.email, dietPrefs: user.dietPrefs };
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, config.jwt.accessSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.accessTtl,
  });
}

async function issueRefreshToken(user) {
  const token = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    UserId: user.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000),
  });
  return token;
}

async function issueTokens(user) {
  return { accessToken: signAccessToken(user), refreshToken: await issueRefreshToken(user) };
}

async function register({ username, email, password }) {
  const clash = await User.findOne({
    where: { [Op.or]: [{ email: email.toLowerCase() }, { username }] },
  });
  if (clash) {
    const field = clash.email === email.toLowerCase() ? 'email' : 'username';
    throw new AppError(409, `That ${field} is already taken.`);
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ username, email: email.toLowerCase(), passwordHash });
  return { user: publicUser(user), ...(await issueTokens(user)) };
}

async function login({ identifier, password }) {
  const id = identifier.trim();
  const user = await User.findOne({
    where: { [Op.or]: [{ email: id.toLowerCase() }, { username: id }] },
  });
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Email/username or password is not right.');
  return { user: publicUser(user), ...(await issueTokens(user)) };
}

/** Swap a refresh token for a new pair. Presenting an already-used token revokes every session. */
async function refresh(token) {
  const row = await RefreshToken.findOne({ where: { tokenHash: sha256(token) } });
  if (!row) throw new AppError(401, 'Please log in again.');
  if (row.revoked) {
    await RefreshToken.update({ revoked: true }, { where: { UserId: row.UserId } });
    throw new AppError(401, 'Please log in again.');
  }
  if (row.expiresAt < new Date()) throw new AppError(401, 'Your session has expired. Please log in again.');

  const user = await User.findByPk(row.UserId);
  if (!user) throw new AppError(401, 'Please log in again.');
  await row.update({ revoked: true });
  return { user: publicUser(user), ...(await issueTokens(user)) };
}

async function logout(token) {
  await RefreshToken.update({ revoked: true }, { where: { tokenHash: sha256(token) } });
}

module.exports = { register, login, refresh, logout, publicUser, signAccessToken };
