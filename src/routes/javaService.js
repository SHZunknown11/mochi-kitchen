const express = require('express');
const http = require('http');

const router = express.Router();
const JAVA_HOST = '127.0.0.1';
const JAVA_PORT = 8080;

/**
 * Helper to forward requests to the Java microservice
 */
function forwardToJava(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: JAVA_HOST,
      port: JAVA_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Java service request timed out'));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

// GET /api/java/health - Java service status
router.get('/health', async (req, res) => {
  try {
    const javaRes = await forwardToJava('GET', '/api/java/health');
    res.status(javaRes.status).json({
      online: true,
      ...javaRes.body,
    });
  } catch {
    res.json({
      online: false,
      service: 'Mochi Kitchen Java Core Engine',
      port: JAVA_PORT,
      status: 'OFFLINE',
      message: 'Java microservice is currently offline. Run "npm run java:start" to activate Java metrics.',
    });
  }
});

// POST /api/java/nutrition - Recipe nutritional analysis
router.post('/nutrition', async (req, res) => {
  try {
    const javaRes = await forwardToJava('POST', '/api/java/nutrition', req.body);
    res.status(javaRes.status).json({
      javaOnline: true,
      ...javaRes.body,
    });
  } catch {
    // Fallback if Java service is paused
    res.json({
      javaOnline: false,
      recipe: req.body.title || 'Dish',
      calories: 420,
      proteinGrams: 18.5,
      carbsGrams: 45.0,
      fatGrams: 12.0,
      fiberGrams: 4.5,
      healthScore: 88,
      macroRating: 'Balanced Nutrition (Java Offline Fallback)',
      details: { note: 'Start Java service with "npm run java:start" for live JVM analysis' },
    });
  }
});

// POST /api/java/workload - Kitchen workload & difficulty estimation
router.post('/workload', async (req, res) => {
  try {
    const javaRes = await forwardToJava('POST', '/api/java/workload', req.body);
    res.status(javaRes.status).json({
      javaOnline: true,
      ...javaRes.body,
    });
  } catch {
    res.json({
      javaOnline: false,
      estimatedPrepMinutes: 10,
      estimatedCookMinutes: 15,
      totalMinutes: 25,
      difficultyLevel: 'Moderate / Home Cook Friendly',
      difficultyStars: 2,
      equipmentRequired: ['Skillet / Pan', "Chef's Knife & Board"],
      primaryTechniques: ['Sauté / Stir-fry', 'Simmering'],
      chefWorkloadTip: 'Mise en place: prep all ingredients before heating your pan!',
    });
  }
});

// POST /api/java/insights - Chef culinary recommendations
router.post('/insights', async (req, res) => {
  try {
    const javaRes = await forwardToJava('POST', '/api/java/insights', req.body);
    res.status(javaRes.status).json({
      javaOnline: true,
      ...javaRes.body,
    });
  } catch {
    res.json({
      javaOnline: false,
      flavorHarmonies: 'Savory Umami · Toasted Sesame',
      proTips: ['Season in layers throughout cooking'],
      pairingAdvice: 'Chilled green tea or sparkling yuzu water',
      seasonality: 'All Seasons Comfort',
    });
  }
});

module.exports = router;

