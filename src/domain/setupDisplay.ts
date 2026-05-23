import { DifficultyLevel } from './gameFlow';

export const DEFAULT_ROUND_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 20] as const;

export const DEFAULT_DIFFICULTY_LEVELS: DifficultyLevel[] = [
  'secondary',
  'undergrad',
  'grad',
  'unlimited',
];

export const difficultyDescriptions: Record<DifficultyLevel, string> = {
  secondary: 'High school level concepts and vocabulary',
  undergrad: 'Recognizable undergraduate-level academic concepts',
  grad: 'Specialized graduate-level concepts',
  unlimited: 'Advanced, obscure, and highly technical concepts',
};

export function formatDifficultyLabel(level: DifficultyLevel) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function getTurnsEachLabel(maxRounds: number) {
  return `${Math.ceil(maxRounds / 2)} turns each`;
}
