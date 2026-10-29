const { GoogleGenAI } = require('@google/genai');
const config = require('../config');
const core = require('./geminiCore');

const { AiUnavailableError, safeTerms } = core;

let client = null;
function getClient() {
  if (client) return client;
  if (!config.gemini.apiKey) throw new AiUnavailableError('No Gemini API key configured');
  client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return client;
}
/** Test hook: inject a fake client. */
function setClient(fake) {
  client = fake;
}
const isConfigured = () => Boolean(config.gemini.apiKey) || client !== null;

async function generateJson(prompt) {
  const ai = getClient();
  let timer;
  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: config.gemini.model,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.8 },
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), config.gemini.timeoutMs);
      }),
    ]);
    const text = String(response.text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    throw new AiUnavailableError(err instanceof SyntaxError ? 'Gemini returned unreadable JSON' : 'Gemini request failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask Gemini for recipe ideas. Only NLP-extracted keywords are sent (never the raw query),
 * which keeps the prompt tight and removes any chance of prompt injection through user text.
 */
async function suggestRecipes(opts) {
  return core.parseSuggestions(await generateJson(core.buildSuggestPrompt(opts)));
}

/** Ask Gemini to arrange REAL stored recipes into a plan (ids outside `candidates` are rejected). */
async function planMeals(opts) {
  return core.parsePlan(await generateJson(core.buildPlanPrompt(opts)), opts);
}

module.exports = { AiUnavailableError, isConfigured, setClient, suggestRecipes, planMeals, safeTerms };
