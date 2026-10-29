import app from './app.js';

const hono = app.createApp();

export default {
  async fetch(request, env, ctx) {
    return hono.fetch(request, env, ctx);
  },
};
