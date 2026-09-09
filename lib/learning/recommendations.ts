import type { LearningGoal } from "./types.ts";

export type PracticeRecommendationKind =
  | "vocabulary_review"
  | "mistake_practice"
  | "daily_goal"
  | "roleplay"
  | "conversation";

export interface PracticeRecommendation {
  kind: PracticeRecommendationKind;
  title: string;
  reason: string;
  href: string;
}

export interface RecommendationMistake {
  category: string;
  count: number;
  recentCount?: number;
  affectedSessions?: number;
  trend?: string | null;
}

export interface RecommendedPracticeInput {
  dueVocabularyCount: number;
  mistakes: RecommendationMistake[];
  minutesToday: number;
  dailyTargetMinutes: number;
  learningGoal: LearningGoal;
}

const goalScenario: Partial<Record<LearningGoal, { id: string; title: string }>> = {
  travel: { id: "airport-checkin", title: "Try an airport roleplay" },
  business: { id: "client-call", title: "Practice a client call" },
  interview_preparation: { id: "job-interview", title: "Run a job interview roleplay" },
  academic_language: { id: "team-meeting", title: "Practice structured discussion" },
  everyday_conversation: { id: "coffee-shop", title: "Practice an everyday roleplay" },
};

function categoryLabel(category: string) {
  return category.replaceAll("_", " ");
}

export function buildRecommendedPractice(
  input: RecommendedPracticeInput,
): PracticeRecommendation[] {
  const recommendations: PracticeRecommendation[] = [];

  if (Number.isFinite(input.dueVocabularyCount) && input.dueVocabularyCount > 0) {
    recommendations.push({
      kind: "vocabulary_review",
      title: "Review vocabulary",
      reason: `${Math.floor(input.dueVocabularyCount)} saved ${input.dueVocabularyCount === 1 ? "word is" : "words are"} due now.`,
      href: "/vocabulary/review",
    });
  }

  const mistake = [...input.mistakes]
    .filter((row) => Number.isFinite(row.count) && row.count > 0)
    .sort(
      (a, b) =>
        (b.recentCount ?? 0) - (a.recentCount ?? 0) ||
        b.count - a.count ||
        (b.affectedSessions ?? 0) - (a.affectedSessions ?? 0),
    )[0];

  if (mistake) {
    recommendations.push({
      kind: "mistake_practice",
      title: `Practice ${categoryLabel(mistake.category)}`,
      reason: `${mistake.count} ${mistake.count === 1 ? "correction" : "corrections"} in your saved feedback point to ${categoryLabel(mistake.category)} as a useful target.`,
      href: `/tutor?mode=mistakes&target=${encodeURIComponent(mistake.category)}`,
    });
  }

  const remaining = Math.max(
    0,
    Math.floor(input.dailyTargetMinutes) - Math.floor(input.minutesToday),
  );
  if (remaining > 0) {
    recommendations.push({
      kind: "daily_goal",
      title: "Continue today's practice",
      reason: `${remaining} ${remaining === 1 ? "minute" : "minutes"} remain toward your daily target.`,
      href: "/tutor",
    });
  }

  const scenario = goalScenario[input.learningGoal];
  if (scenario) {
    recommendations.push({
      kind: "roleplay",
      title: scenario.title,
      reason: "This roleplay matches the learning goal saved in your profile.",
      href: `/tutor?mode=roleplay&scenario=${encodeURIComponent(scenario.id)}`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      kind: "conversation",
      title: "Start a conversation",
      reason: "Keep your speaking momentum with a topic you care about.",
      href: "/tutor",
    });
  }

  return recommendations;
}
