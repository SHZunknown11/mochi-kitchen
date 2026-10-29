// Gemini over plain REST (the Node SDK is not needed). Prompts and output validation are shared
// with the Node app through src/services/geminiCore.js.
const core = require('../../src/services/geminiCore');

const { AiUnavailableError } = core;
const TIMEOUT_MS = 40000; // Gemini answers in 6-25 s; waiting on the network does not count as Worker CPU time

const isConfigured = (env) => Boolean(env.GEMINI_API_KEY);

async function generateJson(env, prompt) {
  if (!env.GEMINI_API_KEY) throw new AiUnavailableError('No Gemini API key configured');
  const model = env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = String((parts || []).map((p) => p.text || '').join('')).replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    throw new AiUnavailableError(err instanceof SyntaxError ? 'Gemini returned unreadable JSON' : 'Gemini request failed');
  }
}

const suggestRecipes = async (env, opts) => core.parseSuggestions(await generateJson(env, core.buildSuggestPrompt(opts)));
const planMeals = async (env, opts) => core.parsePlan(await generateJson(env, core.buildPlanPrompt(opts)), opts);

module.exports = { AiUnavailableError, isConfigured, suggestRecipes, planMeals };
