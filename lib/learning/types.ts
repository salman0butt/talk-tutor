export const LEARNING_GOALS = [
  "everyday_conversation",
  "travel",
  "business",
  "interview_preparation",
  "academic_language",
  "general_fluency",
  "immigration",
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
export type CorrectionFrequency = "minimal" | "balanced" | "frequent";
export type ConversationDifficulty = "easy" | "normal" | "challenging";
export type PracticeMode = "conversation" | "roleplay" | "mistakes" | "custom";
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
  correctionFrequency: CorrectionFrequency;
  conversationDifficulty: ConversationDifficulty;
  onboardingCompletedAt: string | null;
  placementCompletedAt: string | null;
  placementScore: number | null;
  recommendedLevel: "Basic" | "Intermediate" | "Top Class" | null;
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
  correctionFrequency?: CorrectionFrequency;
  conversationDifficulty?: ConversationDifficulty;
}

export interface FinalTranscriptMessage {
  role: TranscriptRole;
  text: string;
  sequence: number;
  occurredAt: string;
}

export interface GrammarCorrection {
  /**
   * Finalized learner transcript turn that contains the evidence for this
   * correction. Optional so historical persisted feedback remains readable.
   */
  sourceSequence?: number;
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
  practiceMode?: PracticeMode;
  correctionFrequency?: CorrectionFrequency;
  conversationDifficulty?: ConversationDifficulty;
  scenarioId?: string | null;
  customScenario?: string | null;
  learnerRole?: string | null;
  tutorRole?: string | null;
  targetMistakeCategories?: GrammarCategory[];
  userMessageCount: number;
  feedbackSummary?: string | null;
  fluencyScore?: number | null;
}

export interface DashboardSnapshot {
  totalMinutes: number;
  thisWeekMinutes: number;
  thisMonthMinutes: number;
  previousWeekMinutes: number;
  minutesToday: number;
  completedSessions: number;
  sessionsThisWeek: number;
  vocabularyLearned: number;
  vocabularySaved: number;
  vocabularyLearning: number;
  vocabularyStrong: number;
  vocabularyDue: number;
  newVocabularyThisWeek: number;
  weeklyPractice: Array<{ date: string; minutes: number }>;
  commonMistakes: Array<{
    category: string;
    count: number;
    affectedSessions: number;
    recentCount: number;
    previousCount: number;
  }>;
  recentLanguages: string[];
  recentScores: number[];
  practiceDates: string[];
  vocabularyGrowth: Array<{ date: string; count: number }>;
}

export interface SessionStartInput {
  language: string;
  proficiencyLevel: string;
  topic: string;
  assistantVoice: string;
  practiceMode: PracticeMode;
  scenarioId?: string;
  customScenario?: string;
  learnerRole?: string;
  tutorRole?: string;
  correctionFrequency: CorrectionFrequency;
  difficulty: ConversationDifficulty;
  targetMistakeCategories: GrammarCategory[];
  messages: FinalTranscriptMessage[];
}
