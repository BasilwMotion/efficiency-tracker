# Efficiency Tracker

A single-file web app that tracks work efficiency, sales efficiency, tasks, meetings, and project deadlines. Works on desktop and mobile, offline-first, with optional Supabase cloud sync and a built-in AI assistant powered by open-source models.

## Features

- Dashboard with 7-day work and sales efficiency scores, a to-complete checklist, today's focus, and at-risk deadlines (cards click through to their tabs)
- Tasks with priority, category, and due dates; checkbox completion
- Sales activity log (calls, follow-ups, proposals, closes) with revenue tracking and a daily checklist
- Meetings and project deadlines with overdue flags
- AI chat assistant that can read your data and add/complete/delete items via natural language, using open models (Groq Llama 3.3, OpenRouter free models, or local Ollama)
- Offline-first: data lives in your browser; optional sync to your own Supabase project (last edit wins)

## Setup

1. Open `index.html` (or the deployed URL) in any browser. It works immediately with local storage.
2. Cloud sync (optional): create a free Supabase project, run `supabase-setup.sql` in its SQL editor, then paste your project URL and anon key in Settings.
3. AI assistant (optional): get a free API key from console.groq.com (or openrouter.ai/keys, or run Ollama locally), then set it in Settings → AI Assistant.

Keys are stored only in your browser's local storage. No server, no build step.

## Tests

```
npm install && npm test
```

33 jsdom tests cover data entry, efficiency math, sync, the AI tool-calling loop, input validation, and XSS/attribute-injection hardening.
