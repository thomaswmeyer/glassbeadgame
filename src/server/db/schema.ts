import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const gameStatusValues = [
  'setup',
  'awaiting_response',
  'ai_thinking',
  'evaluating',
  'showing_results',
  'completed',
  'abandoned',
  'error',
] as const;

export const gameModeValues = ['casual', 'rated', 'benchmark', 'experiment'] as const;
export const difficultyLevelValues = ['secondary', 'undergrad', 'grad', 'unlimited'] as const;
export const sourceEnvironmentValues = ['local', 'test', 'render_prod', 'render_preview', 'imported', 'external'] as const;
export const playerKindValues = ['human', 'ai', 'agent', 'openclaw', 'test'] as const;
export const playerControllerKindValues = ['local_human', 'local_ai', 'remote_human', 'remote_ai', 'openclaw', 'test'] as const;
export const subjectCategoryValues = [
  'philosophy',
  'science',
  'mathematics',
  'arts',
  'history',
  'psychology',
  'sociology',
  'technology',
  'religion',
  'economics',
  'other',
] as const;
export const modelInvocationPurposeValues = [
  'generate_topic',
  'ai_move',
  'definition',
  'topic_judge',
  'edge_judge',
  'turn_judge',
  'game_judge',
  'calibration',
] as const;
export const judgeTargetTypeValues = ['topic', 'edge', 'turn', 'game'] as const;
export const experimentBatchStatusValues = ['draft', 'running', 'complete', 'promoted', 'rejected', 'archived'] as const;
export const ratingSystemValues = ['elo', 'glicko2', 'trueskill'] as const;
export const ratingPoolValues = ['casual', 'rated', 'benchmark', 'experimental'] as const;

export const experimentBatches = sqliteTable('experiment_batches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  purpose: text('purpose').notNull(),
  sourceEnvironment: text('source_environment', { enum: sourceEnvironmentValues }).notNull(),
  status: text('status', { enum: experimentBatchStatusValues }).notNull(),
  modelSet: text('model_set').notNull().default('{}'),
  judgeSet: text('judge_set').notNull().default('{}'),
  notes: text('notes'),
  promotedAt: text('promoted_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  kind: text('kind', { enum: playerKindValues }).notNull(),
  provider: text('provider'),
  modelId: text('model_id'),
  modelVersion: text('model_version'),
  agentEndpoint: text('agent_endpoint'),
  ownerUserId: text('owner_user_id'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  status: text('status', { enum: gameStatusValues }).notNull(),
  mode: text('mode', { enum: gameModeValues }).notNull(),
  difficulty: text('difficulty', { enum: difficultyLevelValues }).notNull(),
  maxRounds: integer('max_rounds').notNull(),
  currentRound: integer('current_round').notNull().default(0),
  currentGamePlayerId: text('current_game_player_id'),
  rootTopicId: text('root_topic_id'),
  winnerGamePlayerId: text('winner_game_player_id'),
  rulesVersion: text('rules_version').notNull(),
  scoringVersion: text('scoring_version').notNull(),
  promptSetVersion: text('prompt_set_version').notNull(),
  sourceEnvironment: text('source_environment', { enum: sourceEnvironmentValues }).notNull(),
  experimentBatchId: text('experiment_batch_id'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
}, table => ({
  statusIndex: index('idx_games_status').on(table.status),
  modeIndex: index('idx_games_mode').on(table.mode),
  experimentBatchIndex: index('idx_games_experiment_batch_id').on(table.experimentBatchId),
}));

export const gamePlayers = sqliteTable('game_players', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull(),
  playerId: text('player_id').notNull(),
  seatIndex: integer('seat_index').notNull(),
  displayName: text('display_name').notNull(),
  controllerKind: text('controller_kind', { enum: playerControllerKindValues }).notNull(),
  provider: text('provider'),
  modelId: text('model_id'),
  modelVersion: text('model_version'),
  promptConfigVersion: text('prompt_config_version'),
  finalScore: integer('final_score').notNull().default(0),
  ratingParticipantKey: text('rating_participant_key'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  gameIndex: index('idx_game_players_game_id').on(table.gameId),
  gameSeatUnique: uniqueIndex('uniq_game_players_game_id_seat_index').on(table.gameId, table.seatIndex),
}));

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull(),
  text: text('text').notNull(),
  normalizedText: text('normalized_text').notNull(),
  subjectCategory: text('subject_category', { enum: subjectCategoryValues }).notNull(),
  subjectSubcategory: text('subject_subcategory'),
  createdByGamePlayerId: text('created_by_game_player_id').notNull(),
  createdTurnId: text('created_turn_id'),
  isRoot: integer('is_root').notNull().default(0),
  selectedDefinitionId: text('selected_definition_id'),
  selectedJudgeEvaluationId: text('selected_judge_evaluation_id'),
  layoutX: real('layout_x'),
  layoutY: real('layout_y'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  gameIndex: index('idx_topics_game_id').on(table.gameId),
  normalizedTextIndex: index('idx_topics_normalized_text').on(table.normalizedText),
}));

export const modelInvocations = sqliteTable('model_invocations', {
  id: text('id').primaryKey(),
  purpose: text('purpose', { enum: modelInvocationPurposeValues }).notNull(),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  modelVersion: text('model_version'),
  promptVersion: text('prompt_version').notNull(),
  config: text('config').notNull().default('{}'),
  requestPayload: text('request_payload').notNull().default('{}'),
  rawResponse: text('raw_response'),
  parsedResponse: text('parsed_response'),
  finishReason: text('finish_reason'),
  usageMetadata: text('usage_metadata').notNull().default('{}'),
  error: text('error'),
  sourceEnvironment: text('source_environment', { enum: sourceEnvironmentValues }).notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  purposeIndex: index('idx_model_invocations_purpose').on(table.purpose),
}));

export const topicDefinitions = sqliteTable('topic_definitions', {
  id: text('id').primaryKey(),
  topicId: text('topic_id').notNull(),
  definition: text('definition').notNull(),
  modelInvocationId: text('model_invocation_id'),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  modelVersion: text('model_version'),
  promptVersion: text('prompt_version').notNull(),
  isSelected: integer('is_selected').notNull().default(0),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  topicIndex: index('idx_topic_definitions_topic_id').on(table.topicId),
}));

export const turns = sqliteTable('turns', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull(),
  roundNumber: integer('round_number').notNull(),
  gamePlayerId: text('game_player_id').notNull(),
  destinationTopicId: text('destination_topic_id').notNull(),
  responseText: text('response_text').notNull(),
  combinedScore: integer('combined_score').notNull().default(0),
  selectedJudgeEvaluationId: text('selected_judge_evaluation_id'),
  modelInvocationId: text('model_invocation_id'),
  submittedAt: text('submitted_at').notNull().default('CURRENT_TIMESTAMP'),
  appliedAt: text('applied_at'),
  metadata: text('metadata').notNull().default('{}'),
}, table => ({
  gameRoundIndex: index('idx_turns_game_id_round_number').on(table.gameId, table.roundNumber),
  gameRoundUnique: uniqueIndex('uniq_turns_game_id_round_number').on(table.gameId, table.roundNumber),
}));

export const turnSources = sqliteTable('turn_sources', {
  id: text('id').primaryKey(),
  turnId: text('turn_id').notNull(),
  sourceTopicId: text('source_topic_id').notNull(),
  sourceOrder: integer('source_order').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  turnIndex: index('idx_turn_sources_turn_id').on(table.turnId),
  turnOrderUnique: uniqueIndex('uniq_turn_sources_turn_id_source_order').on(table.turnId, table.sourceOrder),
  turnSourceUnique: uniqueIndex('uniq_turn_sources_turn_id_source_topic_id').on(table.turnId, table.sourceTopicId),
}));

export const edges = sqliteTable('edges', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull(),
  turnId: text('turn_id').notNull(),
  sourceTopicId: text('source_topic_id').notNull(),
  destinationTopicId: text('destination_topic_id').notNull(),
  gamePlayerId: text('game_player_id').notNull(),
  semanticDistanceScore: integer('semantic_distance_score'),
  relevanceScore: integer('relevance_score'),
  noveltyScore: integer('novelty_score'),
  rawEdgeScore: real('raw_edge_score'),
  finalEdgeScore: integer('final_edge_score'),
  scoringDescription: text('scoring_description'),
  semanticDistanceDescription: text('semantic_distance_description'),
  relevanceDescription: text('relevance_description'),
  selectedJudgeEvaluationId: text('selected_judge_evaluation_id'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  gameIndex: index('idx_edges_game_id').on(table.gameId),
  turnIndex: index('idx_edges_turn_id').on(table.turnId),
  sourceDestinationIndex: index('idx_edges_source_destination').on(table.sourceTopicId, table.destinationTopicId),
  turnEndpointsUnique: uniqueIndex('uniq_edges_turn_id_source_topic_id_destination_topic_id')
    .on(table.turnId, table.sourceTopicId, table.destinationTopicId),
}));

export const judgeEvaluations = sqliteTable('judge_evaluations', {
  id: text('id').primaryKey(),
  targetType: text('target_type', { enum: judgeTargetTypeValues }).notNull(),
  targetId: text('target_id').notNull(),
  gameId: text('game_id').notNull(),
  modelInvocationId: text('model_invocation_id'),
  judgeProvider: text('judge_provider').notNull(),
  judgeModelId: text('judge_model_id').notNull(),
  judgeModelVersion: text('judge_model_version'),
  promptVersion: text('prompt_version').notNull(),
  rulesVersion: text('rules_version').notNull(),
  scoringVersion: text('scoring_version').notNull(),
  semanticDistanceScore: integer('semantic_distance_score'),
  relevanceScore: integer('relevance_score'),
  noveltyScore: integer('novelty_score'),
  recognizabilityScore: integer('recognizability_score'),
  combinedScore: integer('combined_score'),
  aestheticScores: text('aesthetic_scores').notNull().default('{}'),
  description: text('description'),
  parsedOutput: text('parsed_output').notNull().default('{}'),
  rawOutput: text('raw_output'),
  isSelected: integer('is_selected').notNull().default(0),
  sourceEnvironment: text('source_environment', { enum: sourceEnvironmentValues }).notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  targetIndex: index('idx_judge_evaluations_target').on(table.targetType, table.targetId),
  gameIndex: index('idx_judge_evaluations_game_id').on(table.gameId),
}));

export const gameAestheticEvaluations = sqliteTable('game_aesthetic_evaluations', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull(),
  judgeEvaluationId: text('judge_evaluation_id').notNull(),
  interestingnessScore: integer('interestingness_score'),
  beautyScore: integer('beauty_score'),
  balanceScore: integer('balance_score'),
  thematicCoherenceScore: integer('thematic_coherence_score'),
  surpriseScore: integer('surprise_score'),
  restraintScore: integer('restraint_score'),
  hesseLikeCompositionScore: integer('hesse_like_composition_score'),
  review: text('review'),
  isSelected: integer('is_selected').notNull().default(0),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  gameIndex: index('idx_game_aesthetic_evaluations_game_id').on(table.gameId),
}));

export const ratingEvents = sqliteTable('rating_events', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull(),
  gamePlayerId: text('game_player_id').notNull(),
  ratingSystem: text('rating_system', { enum: ratingSystemValues }).notNull(),
  ratingPool: text('rating_pool', { enum: ratingPoolValues }).notNull(),
  ratingBefore: real('rating_before').notNull(),
  ratingAfter: real('rating_after').notNull(),
  ratingDelta: real('rating_delta').notNull(),
  uncertaintyBefore: real('uncertainty_before'),
  uncertaintyAfter: real('uncertainty_after'),
  resultSummary: text('result_summary').notNull().default('{}'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, table => ({
  gamePlayerIndex: index('idx_rating_events_game_player_id').on(table.gamePlayerId),
}));

export const sqliteSchema = {
  experimentBatches,
  players,
  games,
  gamePlayers,
  topics,
  modelInvocations,
  topicDefinitions,
  turns,
  turnSources,
  edges,
  judgeEvaluations,
  gameAestheticEvaluations,
  ratingEvents,
};
