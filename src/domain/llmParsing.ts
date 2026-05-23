import { Score } from './game';

export type LlmEvaluationResponse = {
  evaluation: string;
  finalEvaluation?: string;
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
      scores: {
        semanticDistance: 5,
        relevanceQuality: 5,
        currentConnection: {
          semanticDistance: 5,
          similarity: 5,
          subtotal: 10,
        },
        originalConnection: {
          semanticDistance: 5,
          similarity: 5,
          subtotal: 10,
        },
        total: 10,
      },
    };
  }

  return {
    evaluation: 'Error parsing the evaluation. The response could not be properly evaluated.',
    scores: {
      semanticDistance: 5,
      relevanceQuality: 5,
      total: 10,
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
  return JSON.parse(text) as LlmEvaluationResponse;
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
