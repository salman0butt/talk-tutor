import "server-only";

import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth";
import {
  calculateDateKeyStreak,
  localDateKey,
  summarizeFluencyTrend,
} from "@/lib/learning/analytics";
import { requireAuthenticatedUserId } from "@/lib/learning/ownership";
import { LearningRepository } from "@/lib/learning/repository";
import type { LearningProfilePatch } from "@/lib/learning/types";
import { parseProfilePatch } from "@/lib/learning/validation";

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
    recentSessions,
  };
}
