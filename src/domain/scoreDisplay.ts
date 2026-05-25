import { Score } from './game';

export type ScoreDisplayItem = {
  label: string;
  value: number;
  max: number;
  description: string;
};

export function getRegularScoreDisplayItems(score: Score): ScoreDisplayItem[] {
  return [
    {
      label: 'Semantic Distance',
      value: score.semanticDistance,
      max: 10,
      description: 'Measures how well the concepts are connected intellectually.',
    },
    {
      label: 'Relevance',
      value: score.relevanceQuality,
      max: 10,
      description: 'Measures how relevant and appropriate the response is to the topic.',
    },
  ];
}
