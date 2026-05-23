# Glass Bead Game

A casual, LLM-powered concept association game inspired by Hermann Hesse's
_The Glass Bead Game_. The player and an AI opponent take turns making short
conceptual moves. Each move is scored for how interestingly it connects to the
current topic, and then that response becomes the next topic.

This repo is a Next.js prototype. It is playable locally and has a focused
domain test suite for game logic.

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

Use this smoke test after starting the dev server:

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
npm test
npx tsc --noEmit
npm run build
```

## Execution Plan

The next architecture pass should keep the game playable by local users while
opening it up to networked players, hosted LLM agents, MCP tools, and GraphQL
or REST clients.

Near-term implementation steps:

1. Persist game sessions by id so a game can be resumed and accessed over an
   authenticated network boundary.
2. Expose a small HTTP JSON API for reading game state and submitting turns.
   MCP and GraphQL should be adapters over the same game service rather than
   separate game implementations.
3. Extend the player controller model so local humans, local AIs, remote
   humans, remote AIs, and OpenClaw-style agents all submit through the same
   turn contract.
4. Return incremental turn updates to remote agents by default. A remote agent
   should receive the new node, new edge or edges, edge scoring descriptions,
   combined turn score, current round, current player, player order, and any
   game-status changes since the agent's last acknowledged turn. Agents can
   request a full snapshot when joining, reconnecting, or detecting a missed
   sequence number.
5. Support games with more than two players in the protocol. Every state update
   should include enough player metadata for the agent to know whose turn it is,
   where that player sits in the turn order, and whether the update came from a
   local human, local AI, remote human, or remote AI.
6. Let remote agents choose their own source node selection for a turn. The
   submitted turn should include the destination topic plus one or more source
   node ids chosen by the agent.
7. Validate submitted source node ids server-side against the current game
   graph and player permissions before scoring or applying the turn.
8. Redesign scoring around edge-level scores, multi-source turn aggregation,
   and a wider useful score range. See "Scoring Pass Notes" below.
9. Keep edge-level scoring descriptions on each edge, and store the combined
   turn score separately on the turn.
10. Tune the scoring prompt, probably with concrete examples across the full
   score range, so the evaluator uses more of the scale.
11. Add mocked service tests for remote turn submission, incremental updates,
   missed-update catch-up, N-player turn order, source-node validation,
   multi-source edge creation, and the combined scoring formula.
12. Add a rated benchmark mode for model and agent leaderboards. See
   "Leaderboards, Hosting, and Partnerships" below.

## Scoring Pass Notes

The current scoring model adds semantic distance and relevance/similarity. In
practice, that tends to compress scores into a narrow mid-high range, often
around 12-18, which makes good and great moves hard to distinguish.

The scoring pass should test a multiplicative edge score instead:

```text
edgeScore = semanticDistance * relevance
```

This makes the evaluator punish moves that are only strong on one axis. A move
that is highly relevant but obvious should not score like a move that is both
relevant and conceptually distant. A move that is distant but weakly connected
should also be penalized.

For turns that connect a new topic to multiple source nodes, score each edge
first, then combine the edge scores into the turn score with diminishing
returns:

```text
turnScore = sum(edgeScores) / sqrt(numberOfEdges)
```

This rewards agents for finding several meaningful connections while avoiding a
simple linear advantage for selecting many nodes.

The scoring prompt will also need tuning. It should include concrete examples
across the full score range, including failed connections, obvious-but-valid
connections, elegant connections, and strained high-distance connections. The
goal is to make the judge use the whole range, not just a safe middle band.

## Leaderboards, Hosting, and Partnerships

The game can become a model-quality evaluation if rated games are separated
from casual play. A rated mode should treat completed games as matches among
one or more players, then update model or agent ratings from the final scores.

For ELO-style ranking:

- Keep in-game score as the match result signal.
- Convert an N-player game into pairwise outcomes.
- If player A's final score is greater than player B's final score, A beats B.
- If scores are equal, record a draw.
- Store rating updates separately from game state.

Plain ELO is a reasonable starting point, but Glicko-2 or TrueSkill may be a
better fit later because agents will play uneven numbers of games, multiplayer
matches are common, and uncertainty matters for new entrants.

Rated benchmark records should include:

- model or agent id
- provider
- model version
- prompt/config version
- game rules version
- scoring prompt version
- judge model/version
- difficulty level
- max rounds
- player order policy
- final score and rating delta
- replayable turn log

Hosting costs should be controlled with separate modes:

- **Casual mode:** cheap judges, strict quotas, cached definitions, and no
  official leaderboard impact.
- **Rated mode:** limited daily games, rating updates, affordable judges, and
  sampled frontier-model review.
- **Verified benchmark mode:** sponsor-funded or paid submissions, fixed rules,
  replayable logs, anti-cheat checks, and frontier judge ensembles.

Potential partner categories:

- **Leaderboard and benchmark partners:** LMArena/Arena, Artificial Analysis,
  and Scale AI/SEAL. These organizations are closest to public model ranking,
  benchmark credibility, or formal third-party model evaluation.
- **Eval and observability partners:** Braintrust, LangSmith, Humanloop, and
  Arize. These are good fits for traces, experiment tracking, evaluator
  calibration, and enterprise packaging.
- **Inference and hosting partners:** Together AI, Fireworks AI, Cloudflare,
  Hugging Face, and similar providers. These are good fits for credits,
  serverless inference, open-model coverage, and cost control.
- **Model labs:** OpenAI, Anthropic, Google DeepMind, xAI, Meta, Mistral, and
  Cohere. These are harder conversations, but the pitch is strongest once the
  leaderboard shows useful signal.

The pitch should be that this measures something ordinary static benchmarks
often miss: strategic, creative, multi-step conceptual play by agents over a
shared evolving graph state.

## Current Maintenance Notes

- `npm test` runs the focused domain test suite.
- `npm run lint` is ESLint 9-compatible and should exit without warnings.
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
