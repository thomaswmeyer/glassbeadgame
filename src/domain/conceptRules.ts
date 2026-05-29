export const MAX_CONCEPT_WORDS = 5;

export type ConceptValidationResult = {
  valid: boolean;
  wordCount: number;
  message?: string;
};

export function countConceptWords(concept: string) {
  return concept
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function validateConceptLength(concept: string): ConceptValidationResult {
  const wordCount = countConceptWords(concept);

  if (wordCount === 0) {
    return {
      valid: false,
      wordCount,
      message: 'Topic is required.',
    };
  }

  if (wordCount > MAX_CONCEPT_WORDS) {
    return {
      valid: false,
      wordCount,
      message: `Topics must be ${MAX_CONCEPT_WORDS} words or fewer.`,
    };
  }

  return {
    valid: true,
    wordCount,
  };
}
