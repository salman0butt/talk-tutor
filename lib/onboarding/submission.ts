import {
  scorePlacementAnswers,
  type ProficiencyLevel,
} from "./placement.ts";
import {
  getOnboardingRecommendation,
  isOnboardingGoal,
  type OnboardingGoal,
} from "./recommendations.ts";

const LEVELS = new Set<ProficiencyLevel>([
  "Basic",
  "Intermediate",
  "Top Class",
]);

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export interface OnboardingSubmission {
  goal: OnboardingGoal;
  score: number;
  recommendedLevel: ProficiencyLevel;
  selectedLevel: ProficiencyLevel;
  recommendation: ReturnType<typeof getOnboardingRecommendation>;
}

export function parseOnboardingSubmission(
  value: unknown,
): OnboardingSubmission {
  const data = asRecord(value, "Onboarding submission");

  if (!isOnboardingGoal(data.goal)) {
    throw new Error("Choose a supported onboarding goal.");
  }

  const answersRecord = asRecord(data.answers, "Placement answers");
  const answers: Record<string, string> = {};
  for (const [key, answer] of Object.entries(answersRecord)) {
    if (typeof answer !== "string") {
      throw new Error("Every placement answer must be a choice id.");
    }
    answers[key] = answer;
  }

  if (
    typeof data.selectedLevel !== "string" ||
    !LEVELS.has(data.selectedLevel as ProficiencyLevel)
  ) {
    throw new Error("Choose a supported proficiency level.");
  }

  const placement = scorePlacementAnswers(answers);
  const selectedLevel = data.selectedLevel as ProficiencyLevel;

  return {
    goal: data.goal,
    score: placement.score,
    recommendedLevel: placement.recommendedLevel,
    selectedLevel,
    recommendation: getOnboardingRecommendation(data.goal, selectedLevel),
  };
}
