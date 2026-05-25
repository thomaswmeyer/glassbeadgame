import { Score } from './game';
import { SubjectCategoryId, normalizeSubjectCategoryId } from './subjectCategories';

export type LlmEvaluationResponse = {
  evaluation: string;
  destinationSubjectCategory?: SubjectCategoryId;
  scores: Score;
};

export type LlmAiMoveResponse = {
  selectedSourceNodeIds: string[];
  responseText: string;
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

export function fallbackEvaluationResponse(): LlmEvaluationResponse {
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

export function parseEvaluationResponse(evaluationText: string): LlmEvaluationResponse {
  try {
    return parseJsonObject(evaluationText);
  } catch {
    const jsonString = extractLongestJsonObject(evaluationText);
    if (!jsonString) {
      return fallbackEvaluationResponse();
    }

    try {
      return parseJsonObject(jsonString);
    } catch {
      try {
        return parseJsonObject(repairCommonJsonIssues(jsonString));
      } catch {
        return fallbackEvaluationResponse();
      }
    }
  }
}

export function parseAiMoveResponse(responseText: string): LlmAiMoveResponse | null {
  try {
    return normalizeAiMoveResponse(JSON.parse(responseText));
  } catch {
    const jsonString = extractLongestJsonObject(responseText);
    if (!jsonString) return null;

    try {
      return normalizeAiMoveResponse(JSON.parse(jsonString));
    } catch {
      try {
        return normalizeAiMoveResponse(JSON.parse(repairCommonJsonIssues(jsonString)));
      } catch {
        return null;
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

function normalizeAiMoveResponse(value: unknown): LlmAiMoveResponse | null {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const selectedSourceNodeIds = Array.isArray(record.selectedSourceNodeIds)
    ? record.selectedSourceNodeIds.filter((nodeId): nodeId is string => typeof nodeId === 'string')
    : [];
  const responseText = typeof record.responseText === 'string'
    ? record.responseText
    : typeof record.destinationTopic === 'string'
      ? record.destinationTopic
      : '';

  if (!responseText.trim()) return null;

  return {
    selectedSourceNodeIds,
    responseText,
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
