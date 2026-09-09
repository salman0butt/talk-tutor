import {
  GRAMMAR_CATEGORIES,
  type GrammarCategory,
} from "./types.ts";

export interface VocabularyCandidate {
  term: string;
  language: string;
  meaning: string;
  example?: string;
  sourceContext?: string;
}

export interface NormalizedVocabularyCandidate extends VocabularyCandidate {
  normalizedTerm: string;
}

export interface VocabularyExample {
  sentence: string;
  explanation?: string;
  targetMistakeCategory?: GrammarCategory;
}

const CATEGORY_SET = new Set<string>(GRAMMAR_CATEGORIES);

export function normalizeVocabularyTerm(term: string): string {
  return term
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function deduplicateVocabularyCandidates(
  candidates: VocabularyCandidate[],
): NormalizedVocabularyCandidate[] {
  const seen = new Set<string>();
  const result: NormalizedVocabularyCandidate[] = [];

  for (const candidate of candidates) {
    if (
      typeof candidate.term !== "string" ||
      typeof candidate.language !== "string" ||
      typeof candidate.meaning !== "string"
    ) {
      continue;
    }
    const term = candidate.term.trim();
    const language = candidate.language.trim();
    const meaning = candidate.meaning.trim();
    const normalizedTerm = normalizeVocabularyTerm(term);
    if (!normalizedTerm || !language || !meaning) continue;
    const key = `${language}\u0000${normalizedTerm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...candidate,
      term,
      language,
      meaning,
      normalizedTerm,
    });
  }

  return result;
}

function boundedString(
  value: unknown,
  field: string,
  maxLength: number,
  required = false,
) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const text = value.trim();
  if (!text && required) throw new Error(`${field} is required.`);
  if (text.length > maxLength) throw new Error(`${field} is too long.`);
  return text || undefined;
}

export function parseVocabularyExample(input: unknown): VocabularyExample {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Vocabulary example must be an object.");
  }
  const data = input as Record<string, unknown>;
  const sentence = boundedString(data.sentence, "Sentence", 1000, true)!;
  const explanation = boundedString(data.explanation, "Explanation", 1000);
  const category = boundedString(
    data.targetMistakeCategory,
    "Target mistake category",
    40,
  );
  if (category && !CATEGORY_SET.has(category)) {
    throw new Error("Unsupported target mistake category.");
  }

  return {
    sentence,
    ...(explanation ? { explanation } : {}),
    ...(category
      ? { targetMistakeCategory: category as GrammarCategory }
      : {}),
  };
}


export type VocabularyLearningStatus = "learning" | "strong";

export interface SavedVocabularyItem {
  id: string;
  term: string;
  normalizedTerm: string;
  language: string;
  meaning: string;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  personalizedExample: string | null;
  personalizedExplanation: string | null;
  personalizedExampleMistakeCategory: GrammarCategory | null;
  sourceSessionId: string | null;
  sourceContext: string | null;
  status: VocabularyLearningStatus;
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyOverview {
  saved: number;
  learning: number;
  strong: number;
  due: number;
  nextDueAt: string | null;
  recent: Array<{
    id: string;
    term: string;
    language: string;
    meaning: string;
    status: VocabularyLearningStatus;
    nextReviewAt: string;
    createdAt: string;
  }>;
}
