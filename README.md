# TdrEka: Talk to the Machine

A minimalist multi-session chat interface built with Next.js and React, powered by the Groq Chat Completions API.

## What this project does

- Sends user prompts to Groq (`/openai/v1/chat/completions`) from the client.
- Renders a clean split-pane chat UI with:
  - Session sidebar (create, switch, delete)
  - Message list with loading and entry animations
  - Per-session metrics bar (completion tokens, total tokens, model)
- Persists chat sessions to browser `localStorage`.
- Uses a custom dark visual system defined in CSS variables.

## Tech stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui component scaffold present in repo
- Vercel Analytics (production only)

## Getting started

## 1) Install dependencies

Use one package manager consistently.

```bash
npm install
```

or

```bash
pnpm install
```

## 2) Configure environment variables

Create a local env file:

```bash
cp .env.local.example .env.local
```

If `.env.local.example` does not exist yet, create `.env.local` manually with:

```bash
NEXT_PUBLIC_GROQ_API_KEY=your_groq_api_key_here
```

You can generate/manage your key from the Groq console.

## 3) Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## Available scripts

- `npm run dev`: Start local development server.
- `npm run build`: Build production bundle.
- `npm run start`: Start production server.
- `npm run lint`: Run ESLint across the project.

## Project structure

```text
app/
  globals.css        # Design tokens, theme variables, and animations
  layout.tsx         # Root metadata, icons, and analytics wiring
  page.tsx           # Main chat app (sessions, API calls, UI state)
components/
  ui/                # shadcn/ui generated components
hooks/
lib/
public/              # App icons and image assets
```

## Notes on current implementation

- Chat requests are sent directly from the browser using `NEXT_PUBLIC_GROQ_API_KEY`.
- Session history is stored in `localStorage` under the key `groq_sessions`.
- The active model is currently hardcoded in `app/page.tsx` as `llama-3.3-70b-versatile`.

## Recommended next improvements

- Move Groq requests behind a Next.js route handler to avoid exposing API keys in the client.
- Add markdown rendering for assistant responses.
- Add streaming responses for lower perceived latency.
- Add automated tests for session persistence and chat flow.

## Troubleshooting

- If you see auth errors: verify `NEXT_PUBLIC_GROQ_API_KEY` in `.env.local` and restart the dev server.
- If sessions seem stale: clear `localStorage` for `groq_sessions` in browser devtools.
- If build behaves unexpectedly: remove `.next/` and reinstall dependencies.

## License

No license file is currently included in this repository.
