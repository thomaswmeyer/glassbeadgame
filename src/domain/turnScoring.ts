import { Score } from './game';

export type SourceTurnEvaluation = {
  sourceNodeId: string;
  sourceTopic: string;
  evaluation: string;
  finalEvaluation?: string;
  scores: Score;
};

export function calculateEdgeTotalScore(score: Pick<Score, 'semanticDistance' | 'relevanceQuality'>) {
  return Math.round(score.semanticDistance * score.relevanceQuality);
}

export function normalizeScore(score: Score): Score {
  if (score.currentConnection && score.originalConnection) {
    const currentConnection = {
      ...score.currentConnection,
      subtotal: Math.round(score.currentConnection.semanticDistance * score.currentConnection.similarity),
    };
    const originalConnection = {
      ...score.originalConnection,
      subtotal: Math.round(score.originalConnection.semanticDistance * score.originalConnection.similarity),
    };

    return {
      ...score,
      currentConnection,
      originalConnection,
      total: Math.round((currentConnection.subtotal + originalConnection.subtotal) / 2),
    };
  }

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

  const circleScores = normalizedScores.filter(score => score.currentConnection && score.originalConnection);
  if (circleScores.length === normalizedScores.length) {
    combinedScore.currentConnection = {
      semanticDistance: Math.round(
        circleScores.reduce((sum, score) => sum + score.currentConnection!.semanticDistance, 0) / scoreCount
      ),
      similarity: Math.round(
        circleScores.reduce((sum, score) => sum + score.currentConnection!.similarity, 0) / scoreCount
      ),
      subtotal: Math.round(
        circleScores.reduce((sum, score) => sum + score.currentConnection!.subtotal, 0) / scoreCount
      ),
    };
    combinedScore.originalConnection = {
      semanticDistance: Math.round(
        circleScores.reduce((sum, score) => sum + score.originalConnection!.semanticDistance, 0) / scoreCount
      ),
      similarity: Math.round(
        circleScores.reduce((sum, score) => sum + score.originalConnection!.similarity, 0) / scoreCount
      ),
      subtotal: Math.round(
        circleScores.reduce((sum, score) => sum + score.originalConnection!.subtotal, 0) / scoreCount
      ),
    };
  }

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

export function formatCombinedFinalEvaluation(edgeEvaluations: SourceTurnEvaluation[]) {
  const finalEvaluations = edgeEvaluations.filter(edgeEvaluation => edgeEvaluation.finalEvaluation);
  if (finalEvaluations.length <= 1) {
    return finalEvaluations[0]?.finalEvaluation;
  }

  return finalEvaluations
    .map(edgeEvaluation => (
      `Original-topic connection from "${edgeEvaluation.sourceTopic}":\n${edgeEvaluation.finalEvaluation}`
    ))
    .join('\n\n');
}
