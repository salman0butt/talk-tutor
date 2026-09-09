export type ProficiencyLevel = "Basic" | "Intermediate" | "Top Class";

export interface PlacementQuestion {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  correctOptionId: string;
}

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: "meaning-1",
    prompt: "Choose the sentence that means you do this every day.",
    options: [
      { id: "a", label: "I work here every day." },
      { id: "b", label: "I worked here yesterday." },
      { id: "c", label: "I will worked here." },
    ],
    correctOptionId: "a",
  },
  {
    id: "grammar-1",
    prompt: "Choose the correct sentence.",
    options: [
      { id: "a", label: "She go to school." },
      { id: "b", label: "She goes to school." },
      { id: "c", label: "She going school." },
    ],
    correctOptionId: "b",
  },
  {
    id: "vocabulary-1",
    prompt: "Which word is closest to 'purchase'?",
    options: [
      { id: "a", label: "Buy" },
      { id: "b", label: "Borrow" },
      { id: "c", label: "Break" },
    ],
    correctOptionId: "a",
  },
  {
    id: "grammar-2",
    prompt: "Choose the best completion: If I had more time, I ___ more.",
    options: [
      { id: "a", label: "travel" },
      { id: "b", label: "would travel" },
      { id: "c", label: "will traveled" },
    ],
    correctOptionId: "b",
  },
  {
    id: "meaning-2",
    prompt: "Choose the most natural polite request.",
    options: [
      { id: "a", label: "Give me the form." },
      { id: "b", label: "Could you help me with this form?" },
      { id: "c", label: "Form now." },
    ],
    correctOptionId: "b",
  },
  {
    id: "grammar-3",
    prompt: "Choose the correct sentence.",
    options: [
      { id: "a", label: "By next month, I will have finished the course." },
      { id: "b", label: "By next month, I finish yesterday." },
      { id: "c", label: "By next month, I have finish." },
    ],
    correctOptionId: "a",
  },
];

export function recommendLevelFromScore(score: number): ProficiencyLevel {
  if (!Number.isInteger(score) || score < 0 || score > PLACEMENT_QUESTIONS.length) {
    throw new Error("Placement score must be between 0 and 6.");
  }
  if (score <= 2) return "Basic";
  if (score <= 4) return "Intermediate";
  return "Top Class";
}

export function scorePlacementAnswers(
  answers: Record<string, string>,
): { score: number; recommendedLevel: ProficiencyLevel } {
  let score = 0;

  for (const question of PLACEMENT_QUESTIONS) {
    const answer = answers[question.id];
    if (typeof answer !== "string" || !question.options.some((option) => option.id === answer)) {
      throw new Error(`A valid answer is required for ${question.id}.`);
    }
    if (answer === question.correctOptionId) score += 1;
  }

  return { score, recommendedLevel: recommendLevelFromScore(score) };
}
