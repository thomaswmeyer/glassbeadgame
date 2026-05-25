export type SubjectCategoryId =
  | 'philosophy'
  | 'science'
  | 'mathematics'
  | 'arts'
  | 'history'
  | 'psychology'
  | 'sociology'
  | 'technology'
  | 'religion'
  | 'economics';

export type SubjectCategory = {
  id: SubjectCategoryId;
  name: string;
  promptName: string;
  color: string;
  subcategories: string[];
};

export const subjectCategories: SubjectCategory[] = [
  {
    id: 'philosophy',
    name: 'Philosophy',
    promptName: 'philosophical concept',
    color: '#7C3AED',
    subcategories: [
      'epistemology', 'metaphysics', 'ethics', 'aesthetics',
      'logic', 'political philosophy', 'philosophy of mind',
      'philosophy of language', 'existentialism', 'phenomenology',
    ],
  },
  {
    id: 'science',
    name: 'Science',
    promptName: 'scientific concept',
    color: '#059669',
    subcategories: [
      'physics', 'biology', 'chemistry', 'astronomy',
      'neuroscience', 'ecology', 'quantum mechanics',
      'evolutionary biology', 'genetics', 'thermodynamics',
    ],
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    promptName: 'mathematical concept',
    color: '#2563EB',
    subcategories: [
      'geometry', 'algebra', 'calculus', 'number theory',
      'topology', 'statistics', 'game theory', 'set theory',
      'combinatorics', 'differential equations',
    ],
  },
  {
    id: 'arts',
    name: 'Arts',
    promptName: 'artistic concept or movement',
    color: '#DB2777',
    subcategories: [
      'visual arts', 'music', 'literature', 'film',
      'architecture', 'dance', 'theater', 'poetry',
      'sculpture', 'performance art',
    ],
  },
  {
    id: 'history',
    name: 'History',
    promptName: 'historical event or period',
    color: '#B45309',
    subcategories: [
      'ancient history', 'medieval period', 'renaissance',
      'industrial revolution', 'world wars', 'cold war',
      'decolonization', 'civil rights movements',
      'information age', 'cultural revolutions',
    ],
  },
  {
    id: 'psychology',
    name: 'Psychology',
    promptName: 'psychological concept',
    color: '#0891B2',
    subcategories: [
      'cognitive psychology', 'developmental psychology',
      'social psychology', 'clinical psychology',
      'behavioral psychology', 'neuropsychology',
      'personality theory', 'perception', 'memory', 'emotion',
    ],
  },
  {
    id: 'sociology',
    name: 'Sociology',
    promptName: 'sociological concept',
    color: '#4F46E5',
    subcategories: [
      'social structures', 'cultural norms', 'institutions',
      'social movements', 'inequality', 'urbanization',
      'globalization', 'social identity', 'deviance', 'social change',
    ],
  },
  {
    id: 'technology',
    name: 'Technology',
    promptName: 'technological concept or system',
    color: '#475569',
    subcategories: [
      'artificial intelligence', 'internet', 'robotics',
      'biotechnology', 'renewable energy', 'space exploration',
      'virtual reality', 'cybersecurity', 'nanotechnology', 'blockchain',
    ],
  },
  {
    id: 'religion',
    name: 'Religion',
    promptName: 'religious or spiritual concept',
    color: '#9333EA',
    subcategories: [
      'world religions', 'mysticism', 'theology', 'rituals',
      'sacred texts', 'religious institutions', 'spirituality',
      'religious ethics', 'mythology', 'religious symbolism',
    ],
  },
  {
    id: 'economics',
    name: 'Economics',
    promptName: 'economic concept or system',
    color: '#CA8A04',
    subcategories: [
      'microeconomics', 'macroeconomics', 'market structures',
      'monetary policy', 'fiscal policy', 'international trade',
      'labor economics', 'development economics', 'behavioral economics', 'economic history',
    ],
  },
];

const subjectCategoryIds = new Set(subjectCategories.map(category => category.id));

export function isSubjectCategoryId(value: string): value is SubjectCategoryId {
  return subjectCategoryIds.has(value as SubjectCategoryId);
}

export function normalizeSubjectCategoryId(value: string | undefined | null): SubjectCategoryId | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (isSubjectCategoryId(normalized)) return normalized;

  const matchingCategory = subjectCategories.find(category => (
    category.name.toLowerCase() === normalized ||
    category.promptName.toLowerCase() === normalized
  ));

  return matchingCategory?.id;
}

export function getSubjectCategoryColor(subjectCategory?: SubjectCategoryId) {
  return subjectCategories.find(category => category.id === subjectCategory)?.color || '#64748B';
}

export function formatSubjectCategoryPromptOptions() {
  return subjectCategories
    .map(category => `${category.id} (${category.name})`)
    .join(', ');
}
