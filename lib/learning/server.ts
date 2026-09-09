import "server-only";

import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth";
import {
  buildWeeklyPracticeSeries,
  calculateDateKeyStreak,
  localDateKey,
  summarizeFluencyTrend,
} from "@/lib/learning/analytics";
import { requireAuthenticatedUserId } from "@/lib/learning/ownership";
import { selectTargetMistakes } from "@/lib/learning/practice";
import { LearningRepository } from "@/lib/learning/repository";
import type { LearningProfilePatch } from "@/lib/learning/types";
import { isUuid, parseProfilePatch } from "@/lib/learning/validation";

export class LearningAuthenticationError extends Error {
  readonly status = 401;
  constructor() {
    super("Authentication required.");
    this.name = "LearningAuthenticationError";
  }
}

export async function getLearningRepository(): Promise<LearningRepository | null> {
  const [user, accessToken] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!user || !accessToken) return null;
  const userId = requireAuthenticatedUserId(user);
  return new LearningRepository(userId, accessToken);
}

export async function requireLearningRepository() {
  const repository = await getLearningRepository();
  if (!repository) throw new LearningAuthenticationError();
  return repository;
}

export async function getOrCreateLearningProfile() {
  const repository = await requireLearningRepository();
  return repository.ensureProfile();
}

export async function patchLearningProfile(input: unknown) {
  const patch: LearningProfilePatch = parseProfilePatch(input);
  const repository = await requireLearningRepository();
  return repository.patchProfile(patch);
}

export async function getDashboardViewModel() {
  const repository = await requireLearningRepository();
  const [profile, snapshot, recentSessions] = await Promise.all([
    repository.ensureProfile(),
    repository.getDashboardSnapshot(),
    repository.listSessions(5),
  ]);

  const today = localDateKey(new Date(), profile.timezone);

  return {
    profile,
    snapshot,
    streak: calculateDateKeyStreak(snapshot.practiceDates, today),
    fluencyTrend: summarizeFluencyTrend([...snapshot.recentScores].reverse()),
    weeklyPractice: buildWeeklyPracticeSeries(snapshot.weeklyPractice, today, 7),
    recentSessions,
  };
}



export async function getTutorPracticeContext() {
  const repository = await requireLearningRepository();
  const [profile, snapshot] = await Promise.all([
    repository.ensureProfile(),
    repository.getDashboardSnapshot(),
  ]);
  return {
    profile,
    targetMistakeCategories: selectTargetMistakes(snapshot.commonMistakes),
  };
}

export async function getVocabularyViewModel() {
  const repository = await requireLearningRepository();
  const [profile, overview, items] = await Promise.all([
    repository.ensureProfile(),
    repository.getVocabularyOverview(),
    repository.listVocabularyItems(100),
  ]);
  return { profile, overview, items };
}

export async function getVocabularyReviewViewModel() {
  const repository = await requireLearningRepository();
  const [profile, items] = await Promise.all([
    repository.ensureProfile(),
    repository.listDueVocabulary(50),
  ]);
  return { profile, items };
}

export async function getHistoryViewModel() {
  const repository = await requireLearningRepository();
  const [profile, sessions] = await Promise.all([
    repository.ensureProfile(),
    repository.listSessions(50),
  ]);
  return { profile, sessions };
}

export async function getSessionReviewViewModel(sessionId: string) {
  if (!isUuid(sessionId)) return null;

  const repository = await requireLearningRepository();
  const session = await repository.getSession(sessionId);
  if (!session || session.status !== "completed") return null;

  const [profile, messages, feedback] = await Promise.all([
    repository.ensureProfile(),
    repository.getMessages(sessionId),
    repository.getFeedback(sessionId),
  ]);

  return {
    profile,
    session: {
      ...session,
      userMessageCount: messages.filter((message) => message.role === "user").length,
    },
    messages,
    feedback,
  };
}
