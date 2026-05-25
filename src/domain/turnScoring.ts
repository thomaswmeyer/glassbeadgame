import { Score } from './game';
import { SubjectCategoryId } from './subjectCategories';

export type SourceTurnEvaluation = {
  sourceNodeId: string;
  sourceTopic: string;
  evaluation: string;
  destinationSubjectCategory?: SubjectCategoryId;
  scores: Score;
};

export function calculateEdgeTotalScore(score: Pick<Score, 'semanticDistance' | 'relevanceQuality'>) {
  return Math.round(score.semanticDistance * score.relevanceQuality);
}

export function normalizeScore(score: Score): Score {
  return {
    ...score,
    total: calculateEdgeTotalScore(score),
  };
}

export function combineSourceScores(scores: Score[]): Score {
  const normalizedScores = scores.map(normalizeScore);
  if (normalizedScores.length === 0) {
    return {
      semanticDistance: 0,
      relevanceQuality: 0,
      total: 0,
    };
  }
  if (normalizedScores.length === 1) {
    return normalizedScores[0];
  }

  const scoreCount = normalizedScores.length;
  const totalScore = normalizedScores.reduce((sum, score) => sum + score.total, 0);
  const combinedScore: Score = {
    semanticDistance: Math.round(
      normalizedScores.reduce((sum, score) => sum + score.semanticDistance, 0) / scoreCount
    ),
    relevanceQuality: Math.round(
      normalizedScores.reduce((sum, score) => sum + score.relevanceQuality, 0) / scoreCount
    ),
    total: Math.round(totalScore / Math.sqrt(scoreCount)),
  };

  return combinedScore;
}

export function formatCombinedEvaluation(edgeEvaluations: SourceTurnEvaluation[]) {
  if (edgeEvaluations.length <= 1) {
    return edgeEvaluations[0]?.evaluation || '';
  }

  return edgeEvaluations
    .map(edgeEvaluation => `Connection to "${edgeEvaluation.sourceTopic}":\n${edgeEvaluation.evaluation}`)
    .join('\n\n');
}
