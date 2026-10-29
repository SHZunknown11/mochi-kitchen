// Password hashing (WebCrypto PBKDF2), access tokens (jose) and refresh-token hashing.
const { SignJWT, jwtVerify } = require('jose');

const enc = new TextEncoder();
const DEFAULT_ITERATIONS = 100000; // Cloudflare Workers allows at most 100,000 for PBKDF2.

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

function iterationsFor(env) {
  const n = Number(env && env.PBKDF2_ITERATIONS);
  return Number.isInteger(n) && n >= 1000 && n <= 100000 ? n : DEFAULT_ITERATIONS;
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** "pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>" with a fresh random salt per user. */
async function hashPassword(password, env) {
  const iterations = iterationsFor(env);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored).split('$');
  if (scheme !== 'pbkdf2-sha256' || !salt || !hash) return false;
  const actual = await derive(password, fromB64(salt), Number(iter));
  return safeEqual(actual, fromB64(hash));
}

/** A hash that no password matches, with the same cost, so unknown accounts take as long as real ones. */
const dummyHash = (env) => `pbkdf2-sha256$${iterationsFor(env)}$${toB64(new Uint8Array(16))}$${toB64(new Uint8Array(32))}`;

const secretKey = (secret) => enc.encode(secret);

async function signAccessToken(user, env) {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secretKey(env.JWT_ACCESS_SECRET));
}

async function verifyAccessToken(token, env) {
  try {
    const { payload } = await jwtVerify(token, secretKey(env.JWT_ACCESS_SECRET), { algorithms: ['HS256'] });
    return Number(payload.sub);
  } catch {
    return null;
  }
}

function newRefreshToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(48))); // 96 hex chars
}

/** Refresh tokens are stored as HMAC-SHA256(token) keyed with JWT_REFRESH_SECRET, never in the clear. */
async function hashRefreshToken(token, env) {
  const key = await crypto.subtle.importKey('raw', secretKey(env.JWT_REFRESH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(token)));
}

module.exports = {
  hashPassword, verifyPassword, dummyHash, signAccessToken, verifyAccessToken, newRefreshToken, hashRefreshToken, iterationsFor,
};
