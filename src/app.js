const path = require('path');
const express = require('express');
const helmet = require('helmet');

const { notFound, errorHandler } = require('./middleware/error');
const { apiLimiter } = require('./middleware/rateLimit');

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://www.themealdb.com', 'https://www.thecocktaildb.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api', apiLimiter);
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/favourites', require('./routes/favourites'));
  app.use('/api/grocery', require('./routes/grocery'));
  app.use('/api', require('./routes/recipes'));
  app.use('/api', require('./routes/kitchen'));
  app.use('/api', notFound);

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
