# Mochi Kitchen

An AI-powered recipe finder with a cute Korean/Japanese illustrated look. Full-stack project for Full Stack Development II.

> Work in progress - this README is completed at the end of the build.

## Quick start

```bash
npm install
cp .env.example .env     # then add your own Gemini key (optional)
npm run setup            # creates the database and seeds recipes
npm start                # http://localhost:3000
```

## Gemini API key (you must add your own)

This repository does **not** contain any API key. To enable the AI features, create a free key at
<https://aistudio.google.com/apikey> and put it in your local `.env` file as `GEMINI_API_KEY=...`.
Without a key the app still works using the free recipe APIs.
