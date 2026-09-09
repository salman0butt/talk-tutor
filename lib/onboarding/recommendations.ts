import type { ProficiencyLevel } from "./placement.ts";
import type { ConversationDifficulty, PracticeMode } from "../learning/practice.ts";

export type OnboardingGoal =
  | "travel"
  | "interview_preparation"
  | "academic_language"
  | "immigration";

export const ONBOARDING_GOALS: Array<{
  label: "Travel" | "Job" | "School" | "Immigration";
  value: OnboardingGoal;
  description: string;
}> = [
  {
    label: "Travel",
    value: "travel",
    description: "Practice airports, hotels, restaurants and everyday conversations.",
  },
  {
    label: "Job",
    value: "interview_preparation",
    description: "Prepare for interviews, meetings and workplace communication.",
  },
  {
    label: "School",
    value: "academic_language",
    description: "Improve classroom, presentation and academic communication.",
  },
  {
    label: "Immigration",
    value: "immigration",
    description: "Practice daily life, appointments, forms and official conversations.",
  },
];

const GOAL_SET = new Set<string>(ONBOARDING_GOALS.map(({ value }) => value));

export function isOnboardingGoal(value: unknown): value is OnboardingGoal {
  return typeof value === "string" && GOAL_SET.has(value);
}

function difficultyForLevel(level: ProficiencyLevel): ConversationDifficulty {
  if (level === "Basic") return "easy";
  if (level === "Intermediate") return "normal";
  return "challenging";
}

export interface OnboardingRecommendation {
  topic: string;
  practiceMode: PracticeMode;
  scenarioId?: string;
  difficulty: ConversationDifficulty;
}

export function getOnboardingRecommendation(
  goal: OnboardingGoal,
  level: ProficiencyLevel,
): OnboardingRecommendation {
  const difficulty = difficultyForLevel(level);

  if (goal === "travel") {
    return {
      topic: "Airport check-in",
      practiceMode: "roleplay",
      scenarioId: "airport-checkin",
      difficulty,
    };
  }
  if (goal === "interview_preparation") {
    return {
      topic: "Job interview",
      practiceMode: "roleplay",
      scenarioId: "job-interview",
      difficulty,
    };
  }
  if (goal === "academic_language") {
    return {
      topic: "Classroom presentation practice",
      practiceMode: "custom",
      difficulty,
    };
  }
  return {
    topic: "Daily life appointment practice",
    practiceMode: "custom",
    difficulty,
  };
}
