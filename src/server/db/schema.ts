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

export type GameStatusValue = typeof gameStatusValues[number];
export type GameModeValue = typeof gameModeValues[number];
export type DifficultyLevelValue = typeof difficultyLevelValues[number];
export type SourceEnvironmentValue = typeof sourceEnvironmentValues[number];
export type PlayerKindValue = typeof playerKindValues[number];
export type PlayerControllerKindValue = typeof playerControllerKindValues[number];
export type SubjectCategoryValue = typeof subjectCategoryValues[number];
export type ModelInvocationPurposeValue = typeof modelInvocationPurposeValues[number];
export type JudgeTargetTypeValue = typeof judgeTargetTypeValues[number];
export type ExperimentBatchStatusValue = typeof experimentBatchStatusValues[number];
export type RatingSystemValue = typeof ratingSystemValues[number];
export type RatingPoolValue = typeof ratingPoolValues[number];
