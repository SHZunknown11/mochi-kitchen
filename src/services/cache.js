const { ApiCache } = require('../models');
const config = require('../config');

/**
 * Return a cached JSON value for `key`, or call `loader`, store its result and return it.
 * This keeps us well inside the free-tier rate limits of the recipe APIs (and makes demos fast).
 */
async function cached(key, loader, ttlMs = config.cacheTtlMs) {
  const safeKey = key.slice(0, 200);
  const hit = await ApiCache.findOne({ where: { key: safeKey } });
  if (hit && hit.expiresAt > new Date()) {
    try {
      return JSON.parse(hit.payload);
    } catch {
      // fall through and refresh a corrupt entry
    }
  }

  const value = await loader();
  const expiresAt = new Date(Date.now() + ttlMs);
  const payload = JSON.stringify(value);
  if (hit) await hit.update({ payload, expiresAt });
  else await ApiCache.create({ key: safeKey, payload, expiresAt });
  return value;
}

async function clearExpired() {
  const { Op } = require('sequelize');
  return ApiCache.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
}

module.exports = { cached, clearExpired };
