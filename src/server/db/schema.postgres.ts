import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  difficultyLevelValues,
  experimentBatchStatusValues,
  gameModeValues,
  gameStatusValues,
  judgeTargetTypeValues,
  modelInvocationPurposeValues,
  playerControllerKindValues,
  playerKindValues,
  ratingPoolValues,
  ratingSystemValues,
  sourceEnvironmentValues,
  subjectCategoryValues,
} from './schema';

export const gameStatusEnum = pgEnum('game_status', gameStatusValues);
export const gameModeEnum = pgEnum('game_mode', gameModeValues);
export const difficultyLevelEnum = pgEnum('difficulty_level', difficultyLevelValues);
export const sourceEnvironmentEnum = pgEnum('source_environment', sourceEnvironmentValues);
export const playerKindEnum = pgEnum('player_kind', playerKindValues);
export const playerControllerKindEnum = pgEnum('player_controller_kind', playerControllerKindValues);
export const subjectCategoryEnum = pgEnum('subject_category', subjectCategoryValues);
export const modelInvocationPurposeEnum = pgEnum('model_invocation_purpose', modelInvocationPurposeValues);
export const judgeTargetTypeEnum = pgEnum('judge_target_type', judgeTargetTypeValues);
export const experimentBatchStatusEnum = pgEnum('experiment_batch_status', experimentBatchStatusValues);
export const ratingSystemEnum = pgEnum('rating_system', ratingSystemValues);
export const ratingPoolEnum = pgEnum('rating_pool', ratingPoolValues);

const timestampText = (name: string) => text(name).notNull().default(sql`CURRENT_TIMESTAMP`);

export const experimentBatches = pgTable('experiment_batches', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  purpose: text('purpose').notNull(),
  sourceEnvironment: sourceEnvironmentEnum('source_environment').notNull(),
  status: experimentBatchStatusEnum('status').notNull(),
  modelSet: text('model_set').notNull().default('{}'),
  judgeSet: text('judge_set').notNull().default('{}'),
  notes: text('notes'),
  promotedAt: text('promoted_at'),
  createdAt: timestampText('created_at'),
});

export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  kind: playerKindEnum('kind').notNull(),
  provider: text('provider'),
  modelId: text('model_id'),
  modelVersion: text('model_version'),
  agentEndpoint: text('agent_endpoint'),
  ownerUserId: text('owner_user_id'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: timestampText('created_at'),
});

export const games = pgTable('games', {
  id: uuid('id').primaryKey(),
  status: gameStatusEnum('status').notNull(),
  mode: gameModeEnum('mode').notNull(),
  difficulty: difficultyLevelEnum('difficulty').notNull(),
  maxRounds: integer('max_rounds').notNull(),
  currentRound: integer('current_round').notNull().default(0),
  currentGamePlayerId: uuid('current_game_player_id'),
  rootTopicId: uuid('root_topic_id'),
  winnerGamePlayerId: uuid('winner_game_player_id'),
  rulesVersion: text('rules_version').notNull(),
  scoringVersion: text('scoring_version').notNull(),
  promptSetVersion: text('prompt_set_version').notNull(),
  sourceEnvironment: sourceEnvironmentEnum('source_environment').notNull(),
  experimentBatchId: uuid('experiment_batch_id'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: timestampText('created_at'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
}, table => ({
  statusIndex: index('idx_games_status').on(table.status),
  modeIndex: index('idx_games_mode').on(table.mode),
  experimentBatchIndex: index('idx_games_experiment_batch_id').on(table.experimentBatchId),
}));

export const gamePlayers = pgTable('game_players', {
  id: uuid('id').primaryKey(),
  gameId: uuid('game_id').notNull(),
  playerId: uuid('player_id').notNull(),
  seatIndex: integer('seat_index').notNull(),
  displayName: text('display_name').notNull(),
  controllerKind: playerControllerKindEnum('controller_kind').notNull(),
  provider: text('provider'),
  modelId: text('model_id'),
  modelVersion: text('model_version'),
  promptConfigVersion: text('prompt_config_version'),
  finalScore: integer('final_score').notNull().default(0),
  ratingParticipantKey: text('rating_participant_key'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: timestampText('created_at'),
}, table => ({
  gameIndex: index('idx_game_players_game_id').on(table.gameId),
  gameSeatUnique: uniqueIndex('uniq_game_players_game_id_seat_index').on(table.gameId, table.seatIndex),
}));

export const topics = pgTable('topics', {
  id: uuid('id').primaryKey(),
  gameId: uuid('game_id').notNull(),
  text: text('text').notNull(),
  normalizedText: text('normalized_text').notNull(),
  subjectCategory: subjectCategoryEnum('subject_category').notNull(),
  subjectSubcategory: text('subject_subcategory'),
  createdByGamePlayerId: uuid('created_by_game_player_id').notNull(),
  createdTurnId: uuid('created_turn_id'),
  isRoot: integer('is_root').notNull().default(0),
  selectedDefinitionId: uuid('selected_definition_id'),
  selectedJudgeEvaluationId: uuid('selected_judge_evaluation_id'),
  layoutX: real('layout_x'),
  layoutY: real('layout_y'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: timestampText('created_at'),
}, table => ({
  gameIndex: index('idx_topics_game_id').on(table.gameId),
  normalizedTextIndex: index('idx_topics_normalized_text').on(table.normalizedText),
}));

export const modelInvocations = pgTable('model_invocations', {
  id: uuid('id').primaryKey(),
  purpose: modelInvocationPurposeEnum('purpose').notNull(),
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
  sourceEnvironment: sourceEnvironmentEnum('source_environment').notNull(),
  createdAt: timestampText('created_at'),
}, table => ({
  purposeIndex: index('idx_model_invocations_purpose').on(table.purpose),
}));

export const topicDefinitions = pgTable('topic_definitions', {
  id: uuid('id').primaryKey(),
  topicId: uuid('topic_id').notNull(),
  definition: text('definition').notNull(),
  modelInvocationId: uuid('model_invocation_id'),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  modelVersion: text('model_version'),
  promptVersion: text('prompt_version').notNull(),
  isSelected: integer('is_selected').notNull().default(0),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: timestampText('created_at'),
}, table => ({
  topicIndex: index('idx_topic_definitions_topic_id').on(table.topicId),
}));

export const turns = pgTable('turns', {
  id: uuid('id').primaryKey(),
  gameId: uuid('game_id').notNull(),
  roundNumber: integer('round_number').notNull(),
  gamePlayerId: uuid('game_player_id').notNull(),
  destinationTopicId: uuid('destination_topic_id').notNull(),
  responseText: text('response_text').notNull(),
  combinedScore: integer('combined_score').notNull().default(0),
  selectedJudgeEvaluationId: uuid('selected_judge_evaluation_id'),
  modelInvocationId: uuid('model_invocation_id'),
  submittedAt: timestampText('submitted_at'),
  appliedAt: text('applied_at'),
  metadata: text('metadata').notNull().default('{}'),
}, table => ({
  gameRoundIndex: index('idx_turns_game_id_round_number').on(table.gameId, table.roundNumber),
  gameRoundUnique: uniqueIndex('uniq_turns_game_id_round_number').on(table.gameId, table.roundNumber),
}));

export const turnSources = pgTable('turn_sources', {
  id: uuid('id').primaryKey(),
  turnId: uuid('turn_id').notNull(),
  sourceTopicId: uuid('source_topic_id').notNull(),
  sourceOrder: integer('source_order').notNull(),
  createdAt: timestampText('created_at'),
}, table => ({
  turnIndex: index('idx_turn_sources_turn_id').on(table.turnId),
  turnOrderUnique: uniqueIndex('uniq_turn_sources_turn_id_source_order').on(table.turnId, table.sourceOrder),
  turnSourceUnique: uniqueIndex('uniq_turn_sources_turn_id_source_topic_id').on(table.turnId, table.sourceTopicId),
}));

export const edges = pgTable('edges', {
  id: uuid('id').primaryKey(),
  gameId: uuid('game_id').notNull(),
  turnId: uuid('turn_id').notNull(),
  sourceTopicId: uuid('source_topic_id').notNull(),
  destinationTopicId: uuid('destination_topic_id').notNull(),
  gamePlayerId: uuid('game_player_id').notNull(),
  semanticDistanceScore: integer('semantic_distance_score'),
  relevanceScore: integer('relevance_score'),
  noveltyScore: integer('novelty_score'),
  rawEdgeScore: real('raw_edge_score'),
  finalEdgeScore: integer('final_edge_score'),
  scoringDescription: text('scoring_description'),
  semanticDistanceDescription: text('semantic_distance_description'),
  relevanceDescription: text('relevance_description'),
  selectedJudgeEvaluationId: uuid('selected_judge_evaluation_id'),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: timestampText('created_at'),
}, table => ({
  gameIndex: index('idx_edges_game_id').on(table.gameId),
  turnIndex: index('idx_edges_turn_id').on(table.turnId),
  sourceDestinationIndex: index('idx_edges_source_destination').on(table.sourceTopicId, table.destinationTopicId),
  turnEndpointsUnique: uniqueIndex('uniq_edges_turn_id_source_topic_id_destination_topic_id')
    .on(table.turnId, table.sourceTopicId, table.destinationTopicId),
}));

export const judgeEvaluations = pgTable('judge_evaluations', {
  id: uuid('id').primaryKey(),
  targetType: judgeTargetTypeEnum('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  gameId: uuid('game_id').notNull(),
  modelInvocationId: uuid('model_invocation_id'),
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
  sourceEnvironment: sourceEnvironmentEnum('source_environment').notNull(),
  createdAt: timestampText('created_at'),
}, table => ({
  targetIndex: index('idx_judge_evaluations_target').on(table.targetType, table.targetId),
  gameIndex: index('idx_judge_evaluations_game_id').on(table.gameId),
}));

export const gameAestheticEvaluations = pgTable('game_aesthetic_evaluations', {
  id: uuid('id').primaryKey(),
  gameId: uuid('game_id').notNull(),
  judgeEvaluationId: uuid('judge_evaluation_id').notNull(),
  interestingnessScore: integer('interestingness_score'),
  beautyScore: integer('beauty_score'),
  balanceScore: integer('balance_score'),
  thematicCoherenceScore: integer('thematic_coherence_score'),
  surpriseScore: integer('surprise_score'),
  restraintScore: integer('restraint_score'),
  hesseLikeCompositionScore: integer('hesse_like_composition_score'),
  review: text('review'),
  isSelected: integer('is_selected').notNull().default(0),
  createdAt: timestampText('created_at'),
}, table => ({
  gameIndex: index('idx_game_aesthetic_evaluations_game_id').on(table.gameId),
}));

export const ratingEvents = pgTable('rating_events', {
  id: uuid('id').primaryKey(),
  gameId: uuid('game_id').notNull(),
  gamePlayerId: uuid('game_player_id').notNull(),
  ratingSystem: ratingSystemEnum('rating_system').notNull(),
  ratingPool: ratingPoolEnum('rating_pool').notNull(),
  ratingBefore: real('rating_before').notNull(),
  ratingAfter: real('rating_after').notNull(),
  ratingDelta: real('rating_delta').notNull(),
  uncertaintyBefore: real('uncertainty_before'),
  uncertaintyAfter: real('uncertainty_after'),
  resultSummary: text('result_summary').notNull().default('{}'),
  createdAt: timestampText('created_at'),
}, table => ({
  gamePlayerIndex: index('idx_rating_events_game_player_id').on(table.gamePlayerId),
}));

export const postgresSchema = {
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
