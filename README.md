# Glass Bead Game

A casual, LLM-powered concept association game inspired by Hermann Hesse's
_The Glass Bead Game_. The player and an AI opponent take turns making short
conceptual moves. Each move is scored for how interestingly it connects to the
current topic, and then that response becomes the next topic.

This repo is a Next.js prototype. It is playable locally, but it does not yet
have a formal automated test suite.

## How the Game Works

1. The app asks an LLM to generate a starting topic.
2. The human player and the AI take alternating turns.
3. On each turn, the active player responds to the current topic with a short
   word or phrase, ideally 1-5 words.
4. The response is evaluated by an LLM and given a score out of 20.
5. That response becomes the topic for the next turn.
6. After the configured number of rounds, the player with the highest total
   score wins.

Scores are based on:

- **Semantic distance**: how non-obvious the connection is while still being
  meaningful.
- **Relevance / similarity / quality**: how well the new concept maps back to
  the current topic.

The UI also shows a D3 concept graph so the chain of ideas can be inspected as
the game develops.

## Current Features

- AI-generated starting topics across philosophy, science, math, art, history,
  psychology, sociology, technology, religion, and economics.
- Human vs AI turn-based play.
- Configurable round count.
- Human-first or AI-first game start.
- Difficulty levels: secondary, undergrad, grad, and unlimited.
- LLM scoring and written evaluations after each turn.
- Definition lookup for the current and original topics.
- Concept graph visualization using D3.
- Development model selector for Anthropic Claude and DeepSeek models.
- Production mode that locks the app to the configured Gemini model.

## Tech Stack

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- D3
- Google Gemini API
- Anthropic API
- DeepSeek API via the OpenAI SDK

## Project Structure

```text
src/app/page.tsx                         Main app entry
src/app/components/GameInterface.tsx     Core game state and UI
src/app/components/SimpleConceptGraph.tsx D3 concept graph
src/app/components/ModelSelector.tsx     Development model selector
src/app/api/*/route.ts                   Server-side API endpoints
src/services/llm.ts                      LLM provider calls and prompts
src/config/llm.ts                        Model configuration
```

## Requirements

- Node.js 20.19.0, matching `.nvmrc`
- npm
- At least one LLM API key

Gemini is the default provider in `src/config/llm.ts`, so `GEMINI_API_KEY` is
the simplest key to start with.

## Setup

```bash
nvm use
npm install
cp .env.local.example .env.local
```

Edit `.env.local` and add the keys you want to use:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
NEXT_PUBLIC_PRODUCTION_MODE=false
```

Only the key for the active provider is required. If you leave production mode
off, the development model selector is shown on the start screen.

## Run Locally

```bash
npm run dev
```

Then open:

```text
http://localhost:4321
```

To run a production build locally:

```bash
npm run build
npm run start
```

## Manual Test Pass

There is currently no `npm test` script and no dedicated test runner configured.
For now, use this smoke test after starting the dev server:

1. Open `http://localhost:4321`.
2. Choose a round count, first player, difficulty, and model.
3. Start a game and confirm a starting topic is generated.
4. Submit a short response and confirm an evaluation and score appear.
5. Click through to the next turn and confirm the AI responds.
6. Check that the score totals update.
7. Use the definition button and confirm a definition appears.
8. Confirm the concept graph updates as rounds are added.
9. Finish the configured number of rounds and confirm a winner is shown.

Useful development checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Current Maintenance Notes

- There is still no `npm test` script or dedicated test runner.
- `npm run lint` is ESLint 9-compatible and exits successfully, but it still
  reports warnings for legacy `any` usage, unused state/helpers, and hook
  dependency issues.
- `npm run build` no longer depends on fetching Google-hosted fonts. In
  sandboxed environments, Turbopack may still need permission to spawn worker
  processes and bind its internal worker port.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | For Gemini | Topic generation, AI responses, definitions, and scoring with Gemini |
| `ANTHROPIC_API_KEY` | For Claude | Optional Claude model support |
| `DEEPSEEK_API_KEY` | For DeepSeek | Optional DeepSeek model support |
| `NEXT_PUBLIC_PRODUCTION_MODE` | No | Set to `true` to hide model selection and force the production default model |

## License

MIT. See `LICENSE`.
