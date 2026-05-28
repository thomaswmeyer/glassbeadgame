# Glass Bead Game

A casual, LLM-powered concept association game inspired by Hermann Hesse's
_The Glass Bead Game_. Players take turns adding short conceptual moves to a
shared graph. Each move creates a new topic node, connects it to one or more
existing topic nodes, and is scored for how interestingly those concepts relate.

This repo is a Next.js prototype. It is playable locally and has a focused
domain test suite for game logic.

## How the Game Works

1. The app asks an LLM to generate a starting topic.
2. The local player and the AI take alternating turns.
3. On each turn, the active player responds with a short word or phrase,
   ideally 1-5 words.
4. The response becomes a new topic node in the graph.
5. By default the new node connects to the current topic, but players can
   branch from an older topic or select multiple source topics for a
   multi-source turn.
6. The response is evaluated by an LLM and assigned a turn score.
7. After the configured number of rounds, the player with the highest total
   score wins.

Scores are based on:

- **Semantic distance**: how non-obvious the connection is while still being
  meaningful.
- **Relevance / quality**: how well the new concept maps back to
  the selected source topic or topics.

The UI also shows a D3 concept graph so the branching shape of the game can be
inspected as it develops.

## Current Features

- AI-generated starting topics across philosophy, science, math, art, history,
  psychology, sociology, technology, religion, and economics.
- Local human vs local AI turn-based play.
- Configurable round count.
- Human-first or AI-first game start.
- Difficulty levels: secondary, undergrad, grad, and unlimited.
- LLM scoring and written evaluations after each turn.
- Cached definition lookup for selected topics.
- Branching concept graph visualization using D3.
- Multi-source turns where a new topic can connect to several existing topics.
- Provider-backed LLM topic generation, definitions, AI moves, and scoring.
  Gemini, OpenAI, and Claude model keys are supported.

## Tech Stack

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- D3
- Google Gemini API, OpenAI API, or Anthropic API

## Project Structure

```text
src/app/page.tsx                         Main app entry
src/app/components/GameInterface.tsx     Top-level game UI wiring
src/app/components/GameSetupPanel.tsx    Setup screen and rules
src/app/components/SimpleConceptGraph.tsx D3 concept graph
src/app/api/*/route.ts                   Server-side API endpoints
src/domain/game.ts                       Graph-oriented game state and selectors
src/domain/gameFlow.ts                   Turn flow orchestration helpers
src/domain/graphLayout.ts                Renderer-neutral graph layout helpers
src/domain/llmPrompts.ts                 LLM prompt construction
src/domain/llmParsing.ts                 LLM response parsing and fallbacks
src/services/llm.ts                      LLM provider call orchestration
src/config/llm.ts                        Model configuration
```

## Requirements

- Node.js 20.19.0, matching `.nvmrc`
- npm
- At least one LLM API key

Gemini Flash-Lite is the default model key in `src/config/llm.ts`, so
`GEMINI_API_KEY` is the simplest key to start with. OpenAI and Anthropic keys
can be added when assigning those models to players or judges.

## Setup

```bash
nvm use
npm install
cp .env.local.example .env.local
```

Edit `.env.local` and add the key for whichever provider you want to use:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Model selection is done by model key. The built-in keys are:

- `gemini_flash`
- `gemini_pro`
- `openai_frontier`
- `openai_fast`
- `claude_opus`
- `claude_sonnet`

Use the public player variables to assign default AI players independently:

```bash
NEXT_PUBLIC_GBG_AI_PLAYER_1_MODEL_KEY=gemini_pro
NEXT_PUBLIC_GBG_AI_PLAYER_2_MODEL_KEY=claude_sonnet
```

Use server-only variables to choose model ids and the independent judge model:

```bash
GBG_JUDGE_MODEL_KEY=openai_frontier
OPENAI_FRONTIER_MODEL=gpt-5.2
ANTHROPIC_SONNET_MODEL=claude-sonnet-4-20250514
```

## Run Locally

```bash
npm run dev
```

Then open:

```text
http://localhost:4321
```

To create or update the local SQLite database used for persistence work:

```bash
npm run db:migrate
```

By default this uses:

```text
DATABASE_URL=file:./data/glassbeadgame.dev.sqlite
```

## Deploy

`npm run upload` builds the app, stages the standalone Next.js runtime with
static assets and `public/`, then syncs one complete bundle to
`tomto@gbg.tom.to:/home/tomto/gbg.tom.to/`.

Keep API keys out of the deployed web directory. On the server, store runtime
secrets in a private file:

```bash
cat > /home/tomto/.gbg.env <<'EOF'
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GBG_DEFAULT_AI_MODEL_KEY=gemini_flash
GBG_JUDGE_MODEL_KEY=gemini_flash
EOF
chmod 600 /home/tomto/.gbg.env
```

Start the standalone server with those variables loaded:

```bash
cd /home/tomto/gbg.tom.to
./start.sh
```

On DreamHost shared hosting, use the panel's cron tool to add an `@reboot`
job if the app needs to restart after server maintenance:

```bash
@reboot /home/tomto/gbg.tom.to/start.sh >> /home/tomto/gbg.tom.to/server.log 2>&1
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
4. Submit a short response and confirm a new node, evaluation, and score
   appear.
5. Click through to the next turn and confirm the AI responds.
6. Check that the score totals update.
7. Use the definition button and confirm a definition appears.
8. Select an older topic in the graph or history and confirm the next response
   branches from that topic.
9. Add multiple source topics and confirm the next response creates multiple
   edges.
10. Finish the configured number of rounds and confirm a winner is shown.

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
2. Add Postgres persistence for production and local development. Production
   can use Render Postgres; local development should use a simple local
   Postgres instance, preferably Docker Compose, with separate databases for
   dev, test, and local model experiments.
3. Use UUIDs for persisted games, players, topics, edges, turns, model runs,
   and judge evaluations. Consecutive in-memory ids are fine for prototypes but
   should not become the durable data model.
4. Expose a small HTTP JSON API for reading game state and submitting turns.
   MCP and GraphQL should be adapters over the same game service rather than
   separate game implementations.
5. Extend the player controller model so local humans, local AIs, remote
   humans, remote AIs, and OpenClaw-style agents all submit through the same
   turn contract.
6. Return incremental turn updates to remote agents by default. A remote agent
   should receive the new node, new edge or edges, edge scoring descriptions,
   combined turn score, current round, current player, player order, and any
   game-status changes since the agent's last acknowledged turn. Agents can
   request a full snapshot when joining, reconnecting, or detecting a missed
   sequence number.
7. Support games with more than two players in the protocol. Every state update
   should include enough player metadata for the agent to know whose turn it is,
   where that player sits in the turn order, and whether the update came from a
   local human, local AI, remote human, or remote AI.
8. Let remote agents choose their own source node selection for a turn. The
   submitted turn should include the destination topic plus one or more source
   node ids chosen by the agent.
9. Validate submitted source node ids server-side against the current game
   graph and player permissions before scoring or applying the turn.
10. Redesign scoring around edge-level scores, multi-source turn aggregation,
   and a wider useful score range. See "Scoring Pass Notes" below.
11. Keep edge-level scoring descriptions on each edge, and store the combined
   turn score separately on the turn.
12. Store every judge evaluation as an immutable record with model/provider
   metadata, prompt/config version, raw output, parsed scores, and whether that
   evaluation was the one selected for the applied game result. Turns, topics,
   and whole games may all have multiple evaluations over time.
13. Tune the scoring prompt, probably with concrete examples across the full
   score range, so the evaluator uses more of the scale.
14. Add mocked service tests for remote turn submission, incremental updates,
   missed-update catch-up, N-player turn order, source-node validation,
   multi-source edge creation, and the combined scoring formula.
15. Add a rated benchmark mode for model and agent leaderboards. See
   "Leaderboards, Hosting, and Partnerships" below.

## Persistence and Evaluation Data Model

Production should use Postgres, matching Render's hosted database. Local
development defaults to SQLite because it is simpler for laptop testing and
local model experiments: no server process, one database file, easy resets, and
cheap snapshots. A local Postgres parity mode can still be added later before
production persistence work if database-specific behavior starts to matter.

Suggested local databases:

- `data/glassbeadgame.dev.sqlite`
- `data/glassbeadgame.test.sqlite`
- `data/glassbeadgame.experiments.sqlite`

Local foundation-model experiments should be treated as candidate research
artifacts, not as automatic production replicas. Experiments can generate
games, turns, and evaluations locally, then selected batches can be promoted or
synced to the master dataset with provenance metadata.

All persisted primary ids should be UUIDs. The schema should preserve the
domain concepts already used in memory while keeping model calls and judge
evaluations auditable.

Planned enum domains:

| Enum | Values |
| --- | --- |
| `game_status` | `setup`, `awaiting_response`, `ai_thinking`, `evaluating`, `showing_results`, `completed`, `abandoned`, `error` |
| `game_mode` | `casual`, `rated`, `benchmark`, `experiment` |
| `difficulty_level` | `secondary`, `undergrad`, `grad`, `unlimited` |
| `source_environment` | `local`, `test`, `render_prod`, `render_preview`, `imported`, `external` |
| `player_kind` | `human`, `ai`, `agent`, `openclaw`, `test` |
| `player_controller_kind` | `local_human`, `local_ai`, `remote_human`, `remote_ai`, `openclaw`, `test` |
| `subject_category_id` | `philosophy`, `science`, `mathematics`, `arts`, `history`, `psychology`, `sociology`, `technology`, `religion`, `economics`, `other` |
| `model_invocation_purpose` | `generate_topic`, `ai_move`, `definition`, `topic_judge`, `edge_judge`, `turn_judge`, `game_judge`, `calibration` |
| `judge_target_type` | `topic`, `edge`, `turn`, `game` |
| `experiment_batch_status` | `draft`, `running`, `complete`, `promoted`, `rejected`, `archived` |
| `rating_system` | `elo`, `glicko2`, `trueskill` |
| `rating_pool` | `casual`, `rated`, `benchmark`, `experimental` |

These can be Postgres `ENUM` types at first. If categories, providers, rating
pools, or experiment statuses become admin-editable product data, they can move
to lookup tables later without changing the core relationships.

Planned core tables:

### `games`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `status` | `game_status` | Current game lifecycle state. |
| `mode` | `game_mode` | Casual play, rated play, benchmark, or experiment. |
| `difficulty` | `difficulty_level` | Prompt/scoring difficulty level. |
| `max_rounds` | `integer` | Configured scored rounds, excluding opening turn 0. |
| `current_round` | `integer` | Current scored round. |
| `current_game_player_id` | `uuid` | Nullable FK to `game_players.id`; the seat whose turn it is right now. |
| `root_topic_id` | `uuid` | Nullable FK to `topics.id`. |
| `winner_game_player_id` | `uuid` | Nullable FK to `game_players.id`. |
| `rules_version` | `text` | Version of game rules used for replay/eval compatibility. |
| `scoring_version` | `text` | Version of scoring formula. |
| `prompt_set_version` | `text` | Version of prompts used for generated content/judging. |
| `source_environment` | `source_environment` | Where this game was created/imported. |
| `experiment_batch_id` | `uuid` | Nullable FK to `experiment_batches.id`. |
| `metadata` | `jsonb` | Extra replay, UI, or import metadata. |
| `created_at` | `timestamptz` | Creation time. |
| `started_at` | `timestamptz` | Nullable. |
| `completed_at` | `timestamptz` | Nullable. |

### `players`

Durable identity for a person, model, hosted agent, OpenClaw player, or local
test harness.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `display_name` | `text` | Canonical player/agent/model name. |
| `kind` | `player_kind` | Durable player identity type. |
| `provider` | `text` | Nullable; e.g. `google`, `anthropic`, `openai`, `local`. |
| `model_id` | `text` | Nullable; e.g. `gemini-2.5-pro`. |
| `model_version` | `text` | Nullable provider version/date when available. |
| `agent_endpoint` | `text` | Nullable remote play endpoint. |
| `owner_user_id` | `uuid` | Nullable future FK to users/accounts. |
| `metadata` | `jsonb` | Capabilities, notes, auth hints, benchmark tags. |
| `created_at` | `timestamptz` | Creation time. |

### `game_players`

A seat for a player in one game. This snapshots model/player configuration so a
past game stays replayable even if the durable player changes later.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `game_id` | `uuid` | FK to `games.id`. |
| `player_id` | `uuid` | FK to `players.id`. |
| `seat_index` | `integer` | Turn order position. |
| `display_name` | `text` | Per-game label, e.g. `AI 1`. |
| `controller_kind` | `player_controller_kind` | How this seat submits turns. |
| `provider` | `text` | Snapshot of provider used in this game. |
| `model_id` | `text` | Snapshot of model id used in this game. |
| `model_version` | `text` | Snapshot of model version. |
| `prompt_config_version` | `text` | Player prompt/config version. |
| `final_score` | `integer` | Final gameplay score. |
| `rating_participant_key` | `text` | Stable key for leaderboard/rating aggregation. |
| `metadata` | `jsonb` | Runtime options, capabilities, auth scope, notes. |
| `created_at` | `timestamptz` | Creation time. |

### `topics`

One node in one game's graph.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `game_id` | `uuid` | FK to `games.id`. |
| `text` | `text` | Display topic. |
| `normalized_text` | `text` | Lowercase/canonical form for search and duplicate checks. |
| `subject_category` | `subject_category_id` | Judge/model-assigned category. |
| `subject_subcategory` | `text` | Nullable finer category. |
| `created_by_game_player_id` | `uuid` | FK to `game_players.id`. |
| `created_turn_id` | `uuid` | Nullable FK to `turns.id`; root is turn 0. |
| `is_root` | `boolean` | Opening topic marker. |
| `selected_definition_id` | `uuid` | Nullable FK to `topic_definitions.id`. |
| `selected_judge_evaluation_id` | `uuid` | Nullable FK to `judge_evaluations.id` for topic-level validation/classification. |
| `layout_x` | `double precision` | Optional saved graph position. |
| `layout_y` | `double precision` | Optional saved graph position. |
| `metadata` | `jsonb` | UI/import data. |
| `created_at` | `timestamptz` | Creation time. |

### `topic_definitions`

Definitions are separate so they can be regenerated, cached, compared, and
selected without overwriting history.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `topic_id` | `uuid` | FK to `topics.id`. |
| `definition` | `text` | Display definition. |
| `model_invocation_id` | `uuid` | Nullable FK to `model_invocations.id`. |
| `provider` | `text` | Model provider snapshot. |
| `model_id` | `text` | Model id snapshot. |
| `model_version` | `text` | Model version snapshot. |
| `prompt_version` | `text` | Definition prompt version. |
| `is_selected` | `boolean` | Convenience flag; `topics.selected_definition_id` is authoritative. |
| `metadata` | `jsonb` | Trimming/caching notes. |
| `created_at` | `timestamptz` | Creation time. |

### `turns`

One player action that adds one destination topic. Turn 0 is the opening topic
and has no source topics or edges.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `game_id` | `uuid` | FK to `games.id`. |
| `round_number` | `integer` | `0` for opening topic, then `1..max_rounds`. |
| `game_player_id` | `uuid` | FK to `game_players.id`. |
| `destination_topic_id` | `uuid` | FK to `topics.id`. |
| `response_text` | `text` | Submitted topic text at the time of play. |
| `combined_score` | `integer` | Gameplay score applied to player total. |
| `selected_judge_evaluation_id` | `uuid` | Nullable FK to `judge_evaluations.id` for the applied turn-level result. |
| `model_invocation_id` | `uuid` | Nullable FK to `model_invocations.id` that generated the move. |
| `submitted_at` | `timestamptz` | Time the turn was submitted. |
| `applied_at` | `timestamptz` | Time the turn was accepted into game state. |
| `metadata` | `jsonb` | Client protocol data, retries, fallback markers. |

### `turn_sources`

Ordered source topics chosen for a turn. This keeps the submitted source list
explicit even though each source also has a corresponding edge.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `turn_id` | `uuid` | FK to `turns.id`. |
| `source_topic_id` | `uuid` | FK to `topics.id`. |
| `source_order` | `integer` | Order submitted by the player/agent. |
| `created_at` | `timestamptz` | Creation time. |

### `edges`

One source-to-destination connection. Multi-source turns create multiple edges.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `game_id` | `uuid` | FK to `games.id`. |
| `turn_id` | `uuid` | FK to `turns.id`. |
| `source_topic_id` | `uuid` | FK to `topics.id`. |
| `destination_topic_id` | `uuid` | FK to `topics.id`. |
| `game_player_id` | `uuid` | FK to `game_players.id`. |
| `semantic_distance_score` | `integer` | Edge-level 1-10 score. |
| `relevance_score` | `integer` | Edge-level 1-10 score. |
| `novelty_score` | `integer` | Nullable future score. |
| `raw_edge_score` | `numeric` | Formula output before modifiers/rounding. |
| `final_edge_score` | `integer` | Applied edge score after modifiers. |
| `scoring_description` | `text` | Judge rationale for this edge. |
| `semantic_distance_description` | `text` | Optional axis-specific rationale. |
| `relevance_description` | `text` | Optional axis-specific rationale. |
| `selected_judge_evaluation_id` | `uuid` | Nullable FK to `judge_evaluations.id` for applied edge result. |
| `metadata` | `jsonb` | Layout, imports, future scoring signals. |
| `created_at` | `timestamptz` | Creation time. |

### `model_invocations`

Trace of model calls for generation, definitions, judging, retries, and local
experiments.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `purpose` | `model_invocation_purpose` | Why this model call was made. |
| `provider` | `text` | Provider used. |
| `model_id` | `text` | Model id. |
| `model_version` | `text` | Nullable provider version/date. |
| `prompt_version` | `text` | Prompt template version. |
| `config` | `jsonb` | Temperature, max tokens, thinking budget, response format, etc. |
| `request_payload` | `jsonb` | Sanitized request context. |
| `raw_response` | `text` | Raw text returned by model. |
| `parsed_response` | `jsonb` | Parsed structured output, if any. |
| `finish_reason` | `text` | Nullable provider finish reason. |
| `usage_metadata` | `jsonb` | Tokens, latency, cost estimates. |
| `error` | `text` | Nullable failure detail. |
| `source_environment` | `source_environment` | Where this model call ran. |
| `created_at` | `timestamptz` | Call start time or record time. |

### `judge_evaluations`

Immutable judge output for a topic, edge, turn, or whole game. The evaluated
entity should point to the selected row; all alternate rows remain available
for audit and calibration.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `target_type` | `judge_target_type` | What kind of entity was evaluated. |
| `target_id` | `uuid` | Id of the evaluated row. Enforced by app logic or separate nullable FKs. |
| `game_id` | `uuid` | FK to `games.id` for query locality. |
| `model_invocation_id` | `uuid` | Nullable FK to `model_invocations.id`. |
| `judge_provider` | `text` | Provider snapshot. |
| `judge_model_id` | `text` | Judge model id. |
| `judge_model_version` | `text` | Judge model version/date. |
| `prompt_version` | `text` | Judge prompt version. |
| `rules_version` | `text` | Game rules version assumed by judge. |
| `scoring_version` | `text` | Scoring formula version assumed by judge. |
| `semantic_distance_score` | `integer` | Nullable edge/turn score. |
| `relevance_score` | `integer` | Nullable edge/turn score. |
| `novelty_score` | `integer` | Nullable future score. |
| `recognizability_score` | `integer` | Nullable topic/move validity score. |
| `combined_score` | `integer` | Nullable applied/computed score. |
| `aesthetic_scores` | `jsonb` | Whole-game dimensions such as beauty, balance, coherence, surprise. |
| `description` | `text` | Human-readable rationale/review. |
| `parsed_output` | `jsonb` | Full parsed judge output. |
| `raw_output` | `text` | Raw judge output. |
| `is_selected` | `boolean` | Convenience flag; selected FK on target row is authoritative. |
| `source_environment` | `source_environment` | Where the evaluation was produced. |
| `created_at` | `timestamptz` | Creation time. |

### `game_aesthetic_evaluations`

Optional typed projection over whole-game `judge_evaluations`. This can also be
implemented as a view if the JSON in `judge_evaluations.aesthetic_scores` is
enough.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `game_id` | `uuid` | FK to `games.id`. |
| `judge_evaluation_id` | `uuid` | FK to `judge_evaluations.id`. |
| `interestingness_score` | `integer` | Whole-game quality, not winner scoring. |
| `beauty_score` | `integer` | Whole-game quality. |
| `balance_score` | `integer` | Player/game balance. |
| `thematic_coherence_score` | `integer` | Motif/arc quality. |
| `surprise_score` | `integer` | Non-obviousness of the whole game. |
| `restraint_score` | `integer` | Avoidance of gimmick/repetition. |
| `hesse_like_composition_score` | `integer` | Book-inspired composition quality. |
| `review` | `text` | Written critic review. |
| `is_selected` | `boolean` | Selected whole-game quality review. |
| `created_at` | `timestamptz` | Creation time. |

### `experiment_batches`

Groups local or hosted runs so experimental results can be reviewed and
promoted deliberately.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `name` | `text` | Batch name. |
| `purpose` | `text` | Calibration, local model test, benchmark trial, etc. |
| `source_environment` | `source_environment` | Where it ran. |
| `status` | `experiment_batch_status` | Batch lifecycle. |
| `model_set` | `jsonb` | Players/models in the batch. |
| `judge_set` | `jsonb` | Judges used in the batch. |
| `notes` | `text` | Human notes. |
| `promoted_at` | `timestamptz` | Nullable. |
| `created_at` | `timestamptz` | Creation time. |

### `rating_events`

Append-only rating updates for model, agent, or player leaderboards.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `game_id` | `uuid` | FK to `games.id`. |
| `game_player_id` | `uuid` | FK to `game_players.id`. |
| `rating_system` | `rating_system` | Rating algorithm used. |
| `rating_pool` | `rating_pool` | Leaderboard/rating pool. |
| `rating_before` | `numeric` | Rating before update. |
| `rating_after` | `numeric` | Rating after update. |
| `rating_delta` | `numeric` | Change from this game. |
| `uncertainty_before` | `numeric` | Nullable for Glicko/TrueSkill. |
| `uncertainty_after` | `numeric` | Nullable for Glicko/TrueSkill. |
| `result_summary` | `jsonb` | Pairwise outcomes, final score, placement. |
| `created_at` | `timestamptz` | Creation time. |

Multiple judge evaluations are expected. A turn might be scored first by a
cheap online judge, later re-judged by a frontier model, and later reviewed by
an ensemble. The durable turn should point to the evaluation used for gameplay
and scoring, while the database keeps all alternate evaluations for audit,
calibration, and leaderboard research.

Whole-game reviews should be separate from winner scoring. They answer
questions such as whether a game was beautiful, balanced, varied, coherent, or
too repetitive. This matters for benchmarks because the most interesting games
may come from mixed-model or mixed-agent lineups rather than mirror matches
between two copies of the same model.

## Remaining Refactor Work

The main state model has been moved toward topics, edges, turns, players, and
selectors, and the LLM prompt/parsing code has been separated from provider
calls. The remaining cleanup is intentionally smaller and should happen only
when it supports the next feature pass.

1. Define a renderer-neutral graph view model that is independent of D3. D3 can
   keep owning layout for now, but rendering should consume a stable view model
   so a future WebGL or glass-bead renderer can be swapped in without changing
   game logic.
2. Split provider-specific LLM clients from `src/services/llm.ts` into separate
   files if that orchestration file starts growing again. Prompt construction,
   response parsing, and provider/model configuration are already separate.
3. Continue moving UI-only copy and formatting into small display helpers when
   components start duplicating rules, labels, or score text.
4. Keep README feature and architecture sections current as the app moves from
   a local two-player prototype toward networked multi-player sessions.

## Scoring Pass Notes

The previous scoring model added semantic distance and relevance. In
practice, that tends to compress scores into a narrow mid-high range, often
around 12-18, which makes good and great moves hard to distinguish.

The scoring pass now uses a multiplicative edge score:

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
simple linear advantage for selecting many nodes. The combined turn score is
rounded to the nearest integer before it is added to the player's total.

The scoring prompt includes calibration anchors across the full score range,
including failed connections, obvious-but-valid connections, elegant
connections, and strained high-distance connections. The goal is to make the
judge use the whole range, not just a safe middle band.

Normal tests do not call the model. To run the live model calibration suite,
start the app and then run:

```bash
npm run calibrate:scoring
```

The calibration command posts the examples in
`src/domain/scoringCalibrationExamples.json` to the running evaluation API and
checks whether the configured model stays within the expected score bands.

Future scoring should add novelty as a separate signal from both distance and
relevance. The LLM judge can estimate intrinsic or semantic novelty: whether a
specific connection is fresh, non-obvious, or clichéd in general knowledge. For
example, `DNA -> alphabet` is distant and relevant but a familiar analogy, so
it should receive lower novelty than a less common but still meaningful
connection such as `DNA -> weaving pattern`.

Historical novelty should come from game data rather than the LLM. As games are
played, the system can track exact pair frequency, unordered pair frequency,
domain-pair frequency, and destination subject-area frequency. Those counts can
then reduce the score for moves that repeat well-trodden paths across previous
games.

A likely future edge formula is:

```text
baseEdgeScore = semanticDistance * relevance
llmNoveltyMultiplier = 0.5 + noveltyScore / 10
historicalNoveltyMultiplier = 1 / sqrt(1 + previousSimilarUses)
edgeScore = baseEdgeScore * llmNoveltyMultiplier * historicalNoveltyMultiplier
```

This keeps the responsibilities clean: the LLM judges semantic novelty, while
the database judges observed novelty from actual play history.

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
| `GEMINI_API_KEY` | For Gemini model keys | Topic generation, AI responses, definitions, or scoring through Gemini |
| `OPENAI_API_KEY` | For OpenAI model keys | AI players or judges using OpenAI models |
| `ANTHROPIC_API_KEY` | For Claude model keys | AI players or judges using Anthropic Claude models |
| `GBG_DEFAULT_AI_MODEL_KEY` | No | Server-side fallback model key for AI responses. Defaults to `gemini_flash`. |
| `GBG_JUDGE_MODEL_KEY` | No | Server-side judge/scoring model key. Defaults to the default AI model key. |
| `GBG_TOPIC_MODEL_KEY` | No | Server-side opening-topic generator model key. |
| `GBG_DEFINITION_MODEL_KEY` | No | Server-side definition lookup model key. |
| `NEXT_PUBLIC_GBG_DEFAULT_AI_MODEL_KEY` | No | Browser-visible default model key used when creating AI players. |
| `NEXT_PUBLIC_GBG_AI_PLAYER_1_MODEL_KEY` | No | Browser-visible model key for the first configured AI player. |
| `NEXT_PUBLIC_GBG_AI_PLAYER_2_MODEL_KEY` | No | Browser-visible model key for the second configured AI player. |
| `GEMINI_FLASH_MODEL` / `GEMINI_PRO_MODEL` | No | Provider model-id overrides for Gemini model keys. |
| `OPENAI_FRONTIER_MODEL` / `OPENAI_FAST_MODEL` | No | Provider model-id overrides for OpenAI model keys. |
| `ANTHROPIC_OPUS_MODEL` / `ANTHROPIC_SONNET_MODEL` | No | Provider model-id overrides for Claude model keys. |

## License

MIT. See `LICENSE`.
