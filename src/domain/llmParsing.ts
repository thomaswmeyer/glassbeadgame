import { Score } from './game';
import { SubjectCategoryId, normalizeSubjectCategoryId } from './subjectCategories';

export type LlmEvaluationResponse = {
  evaluation: string;
  finalEvaluation?: string;
  destinationSubjectCategory?: SubjectCategoryId;
  scores: Score;
};

type ParseEvaluationOptions = {
  isFinalRound?: boolean;
};

export function trimIncompleteTrailingSentence(text: string): string {
  const definition = text.trim();
  if (!definition) return definition;
  if (/[.!?]["')\]]?$/.test(definition)) return definition;

  const lastSentenceEnd = Math.max(
    definition.lastIndexOf('.'),
    definition.lastIndexOf('!'),
    definition.lastIndexOf('?')
  );

  if (lastSentenceEnd > 40) {
    return definition.slice(0, lastSentenceEnd + 1).trim();
  }

  return `${definition}.`;
}

export function fallbackEvaluationResponse(isFinalRound = false): LlmEvaluationResponse {
  if (isFinalRound) {
    return {
      evaluation: 'Error parsing the evaluation. The response could not be properly evaluated.',
      finalEvaluation: 'Error parsing the evaluation.',
      destinationSubjectCategory: 'science',
      scores: {
        semanticDistance: 5,
        relevanceQuality: 5,
        currentConnection: {
          semanticDistance: 5,
          relevance: 5,
          subtotal: 25,
        },
        originalConnection: {
          semanticDistance: 5,
          relevance: 5,
          subtotal: 25,
        },
        total: 25,
      },
    };
  }

  return {
    evaluation: 'Error parsing the evaluation. The response could not be properly evaluated.',
    destinationSubjectCategory: 'science',
    scores: {
      semanticDistance: 5,
      relevanceQuality: 5,
      total: 25,
    },
  };
}

export function parseEvaluationResponse(
  evaluationText: string,
  options: ParseEvaluationOptions = {}
): LlmEvaluationResponse {
  try {
    return parseJsonObject(evaluationText);
  } catch {
    const jsonString = extractLongestJsonObject(evaluationText);
    if (!jsonString) {
      return fallbackEvaluationResponse(options.isFinalRound);
    }

    try {
      return parseJsonObject(jsonString);
    } catch {
      try {
        return parseJsonObject(repairCommonJsonIssues(jsonString));
      } catch {
        return fallbackEvaluationResponse(options.isFinalRound);
      }
    }
  }
}

function parseJsonObject(text: string): LlmEvaluationResponse {
  const parsed = JSON.parse(text) as LlmEvaluationResponse;
  return {
    ...parsed,
    destinationSubjectCategory: normalizeSubjectCategoryId(parsed.destinationSubjectCategory),
  };
}

function extractLongestJsonObject(text: string) {
  const matches = text.match(/(\{[\s\S]*\})/g);
  if (!matches?.length) return null;

  return matches.reduce((longest, current) => (
    current.length > longest.length ? current : longest
  ), matches[0]);
}

function repairCommonJsonIssues(jsonString: string) {
  return jsonString
    .replace(/'/g, '"')
    .replace(/(\w+):/g, '"$1":');
}
