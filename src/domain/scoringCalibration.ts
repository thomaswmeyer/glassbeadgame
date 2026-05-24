import rawScoringCalibrationExamples from './scoringCalibrationExamples.json';

export type ScoringCalibrationExample = {
  topic: string;
  response: string;
  semanticDistance: number;
  relevance: number;
  semanticDistanceTolerance: number;
  relevanceTolerance: number;
  rationale: string;
};

export const scoringCalibrationExamples = rawScoringCalibrationExamples as ScoringCalibrationExample[];

export function formatScoringCalibrationExamples(
  examples: ScoringCalibrationExample[] = scoringCalibrationExamples
) {
  return examples
    .map(example => (
      `- "${example.topic}" -> "${example.response}": ` +
      `semanticDistance ${example.semanticDistance}, relevance ${example.relevance}. ` +
      `${example.rationale}`
    ))
    .join('\n');
}
