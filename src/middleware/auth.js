const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const { AppError } = require('./error');

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function userFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.accessSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  return User.findByPk(payload.sub);
}

/** Route guard: 401 unless a valid access token for an existing user is supplied. */
async function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) throw new AppError(401, 'Please log in first.');
  const user = await userFromToken(token);
  if (!user) throw new AppError(401, 'Your session has expired. Please log in again.');
  req.user = user;
  next();
}

/** Attach req.user when a valid token is present, but let anonymous visitors through. */
async function optionalAuth(req, res, next) {
  const token = bearerToken(req);
  if (token) req.user = (await userFromToken(token)) || undefined;
  next();
}

module.exports = { requireAuth, optionalAuth };
