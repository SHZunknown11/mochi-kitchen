const express = require('express');
const auth = require('../services/auth');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const schemas = require('./schemas');

const router = express.Router();

router.post('/register', authLimiter, validate(schemas.register), async (req, res) => {
  res.status(201).json(await auth.register(req.valid.body));
});

router.post('/login', authLimiter, validate(schemas.login), async (req, res) => {
  res.json(await auth.login(req.valid.body));
});

router.post('/refresh', authLimiter, validate(schemas.refresh), async (req, res) => {
  res.json(await auth.refresh(req.valid.body.refreshToken));
});

router.post('/logout', validate(schemas.refresh), async (req, res) => {
  await auth.logout(req.valid.body.refreshToken);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: auth.publicUser(req.user) });
});

router.patch('/me', requireAuth, validate(schemas.profile), async (req, res) => {
  await req.user.update({ dietPrefs: req.valid.body.dietPrefs });
  res.json({ user: auth.publicUser(req.user) });
});

module.exports = router;
