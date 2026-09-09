export const LEARNING_GOALS = [
  "everyday_conversation",
  "travel",
  "business",
  "interview_preparation",
  "academic_language",
  "general_fluency",
] as const;

export const GRAMMAR_CATEGORIES = [
  "articles",
  "verb_tense",
  "prepositions",
  "word_order",
  "pluralization",
  "vocabulary_misuse",
  "agreement",
  "other",
] as const;

export type LearningGoal = (typeof LEARNING_GOALS)[number];
export type GrammarCategory = (typeof GRAMMAR_CATEGORIES)[number];
export type TranscriptRole = "user" | "assistant";
export type SessionStatus = "active" | "completed" | "abandoned";
export type FeedbackStatus =
  | "not_requested"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface LearningProfile {
  id: string;
  preferredLanguage: string;
  proficiencyLevel: string;
  preferredVoice: string;
  learningGoal: LearningGoal;
  dailyPracticeTargetMinutes: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningProfilePatch {
  preferredLanguage?: string;
  proficiencyLevel?: string;
  preferredVoice?: string;
  learningGoal?: LearningGoal;
  dailyPracticeTargetMinutes?: number;
  timezone?: string;
}

export interface FinalTranscriptMessage {
  role: TranscriptRole;
  text: string;
  sequence: number;
  occurredAt: string;
}

export interface GrammarCorrection {
  original: string;
  corrected: string;
  explanation: string;
  category: GrammarCategory;
}

export interface BetterSentence {
  original: string;
  suggestion: string;
  reason?: string;
}

export interface VocabularyItem {
  term: string;
  meaning: string;
  example?: string;
}

export interface SessionFeedback {
  summary: string;
  grammarCorrections: GrammarCorrection[];
  betterSentences: BetterSentence[];
  vocabulary: VocabularyItem[];
  fluency: { score: number; summary: string };
  pronunciationNotes: [];
  nextSteps: string[];
}

export interface LearningSessionSummary {
  id: string;
  language: string;
  proficiencyLevel: string;
  topic: string;
  assistantVoice: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  status: SessionStatus;
  feedbackStatus: FeedbackStatus;
  userMessageCount: number;
  feedbackSummary?: string | null;
  fluencyScore?: number | null;
}

export interface DashboardSnapshot {
  totalMinutes: number;
  completedSessions: number;
  sessionsThisWeek: number;
  vocabularyLearned: number;
  weeklyPractice: Array<{ date: string; minutes: number }>;
  commonMistakes: Array<{ category: string; count: number }>;
  recentLanguages: string[];
  recentScores: number[];
  practiceDates: string[];
}

export interface SessionStartInput {
  language: string;
  proficiencyLevel: string;
  topic: string;
  assistantVoice: string;
  messages: FinalTranscriptMessage[];
}
