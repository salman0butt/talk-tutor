export const VOCABULARY_REVIEW_RATINGS = [
  "again",
  "hard",
  "good",
  "easy",
] as const;

export type VocabularyReviewRating =
  (typeof VOCABULARY_REVIEW_RATINGS)[number];

export interface VocabularyScheduleState {
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  status: string;
}

export interface VocabularyScheduleResult {
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  status: "learning" | "strong";
  nextReviewAt: string;
  lastReviewedAt: string;
}

const RATING_SET = new Set<string>(VOCABULARY_REVIEW_RATINGS);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundedEase(value: number) {
  return Math.round(clamp(value, 1.3, 3) * 100) / 100;
}

function cleanInterval(value: number) {
  if (!Number.isFinite(value)) return 0;
  return clamp(Math.round(value), 0, 3650);
}

function nextDate(reviewedAt: Date, intervalDays: number) {
  const next = new Date(reviewedAt.getTime());
  next.setUTCDate(next.getUTCDate() + intervalDays);
  return next.toISOString();
}

export function isVocabularyDue(
  nextReviewAt: string,
  now: string | Date = new Date(),
) {
  const due = new Date(nextReviewAt);
  const clock = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(due.getTime()) || Number.isNaN(clock.getTime())) {
    throw new Error("Review date must be valid.");
  }
  return due.getTime() <= clock.getTime();
}

export function scheduleVocabularyReview(
  state: VocabularyScheduleState,
  rating: string,
  reviewedAt: string | Date = new Date(),
): VocabularyScheduleResult {
  if (!RATING_SET.has(rating)) {
    throw new Error("Unsupported vocabulary review rating.");
  }

  const clock = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
  if (Number.isNaN(clock.getTime())) throw new Error("Review date is invalid.");

  const previousInterval = cleanInterval(state.intervalDays);
  const previousRepetitions = Math.max(
    0,
    Number.isInteger(state.repetitionCount) ? state.repetitionCount : 0,
  );
  const previousEase = roundedEase(
    Number.isFinite(state.easeFactor) ? state.easeFactor : 2.5,
  );

  let easeFactor = previousEase;
  let intervalDays = 1;
  let repetitionCount = previousRepetitions;

  if (rating === "again") {
    easeFactor = roundedEase(previousEase - 0.2);
    intervalDays = 1;
    repetitionCount = 0;
  } else if (rating === "hard") {
    easeFactor = roundedEase(previousEase - 0.15);
    intervalDays = Math.max(1, Math.round(previousInterval * 1.2));
    repetitionCount = previousRepetitions + 1;
  } else if (rating === "good") {
    repetitionCount = previousRepetitions + 1;
    if (previousRepetitions === 0) intervalDays = 1;
    else if (previousRepetitions === 1) intervalDays = 3;
    else intervalDays = Math.max(1, Math.round(previousInterval * previousEase));
  } else {
    easeFactor = roundedEase(previousEase + 0.15);
    repetitionCount = previousRepetitions + 1;
    if (previousRepetitions === 0) intervalDays = 3;
    else if (previousRepetitions === 1) intervalDays = 7;
    else {
      intervalDays = Math.max(
        1,
        Math.round(previousInterval * previousEase * 1.3),
      );
    }
  }

  intervalDays = clamp(intervalDays, 1, 3650);
  const status =
    repetitionCount >= 5 && intervalDays >= 21 ? "strong" : "learning";

  return {
    easeFactor,
    intervalDays,
    repetitionCount,
    status,
    nextReviewAt: nextDate(clock, intervalDays),
    lastReviewedAt: clock.toISOString(),
  };
}
