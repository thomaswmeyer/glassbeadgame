import { Score } from './game';

export type ScoreDisplayItem = {
  label: string;
  value: number;
  max: number;
  description: string;
};

export type CircleScoreDisplaySection = {
  title: string;
  items: ScoreDisplayItem[];
  subtotal: number;
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
      label: 'Similarity',
      value: score.relevanceQuality,
      max: 10,
      description: 'Measures how relevant and appropriate the response is to the topic.',
    },
  ];
}

export function getCircleScoreDisplaySections(score: Score): CircleScoreDisplaySection[] {
  return [
    {
      title: 'Current Topic Connection',
      subtotal: score.currentConnection?.subtotal || 0,
      items: [
        {
          label: 'Semantic Distance',
          value: score.currentConnection?.semanticDistance || 0,
          max: 10,
          description: 'Connection quality to the current topic.',
        },
        {
          label: 'Similarity',
          value: score.currentConnection?.similarity || 0,
          max: 10,
          description: 'Relevance to the current topic.',
        },
      ],
    },
    {
      title: 'Original Topic Connection',
      subtotal: score.originalConnection?.subtotal || 0,
      items: [
        {
          label: 'Semantic Distance',
          value: score.originalConnection?.semanticDistance || 0,
          max: 10,
          description: 'Connection quality to the original topic.',
        },
        {
          label: 'Similarity',
          value: score.originalConnection?.similarity || 0,
          max: 10,
          description: 'Relevance to the original topic.',
        },
      ],
    },
  ];
}
