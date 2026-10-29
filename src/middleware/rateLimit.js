const rateLimit = require('express-rate-limit');

const inTest = () => process.env.NODE_ENV === 'test' && !process.env.RATE_LIMIT_IN_TEST;

function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: inTest,
    handler: (req, res) => res.status(429).json({ error: { message } }),
  });
}

// General API traffic.
const apiLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  message: 'Too many requests. Please slow down for a moment.',
});

// Brute-force protection for register / login / refresh.
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many login attempts. Please wait a few minutes and try again.',
});

// AI calls cost quota, so they get their own, tighter limit.
const aiLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 12,
  message: 'Mochi needs a short break. Please try the AI again in a minute.',
});

module.exports = { createLimiter, apiLimiter, authLimiter, aiLimiter };
