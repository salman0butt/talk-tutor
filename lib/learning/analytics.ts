import type { DashboardSnapshot } from "./types.ts";
export interface PracticeSessionInput {
  endedAt: string;
  durationSeconds: number;
  userMessageCount: number;
  status: string;
}
export interface MistakeCount { category: string; count: number }
export interface FluencyTrend { current: number | null; previous: number | null; delta: number | null }

const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timeZone: string) {
  let formatter = DATE_FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    DATE_FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}
export function localDateKey(value: string | Date, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  const parts = dateFormatter(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not resolve local date.");
  return `${year}-${month}-${day}`;
}
export function previousDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date key.");
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
export function isMeaningfulPracticeSession(session: PracticeSessionInput): boolean {
  return session.status === "completed" && Number.isFinite(session.durationSeconds)
    && session.durationSeconds >= 60 && Number.isInteger(session.userMessageCount) && session.userMessageCount > 0;
}
export function calculateDateKeyStreak(dateKeys: string[], todayKey: string): number {
  const days = new Set(dateKeys.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)));
  if (days.size === 0) return 0;

  const yesterday = previousDateKey(todayKey);
  let cursor: string | null = days.has(todayKey)
    ? todayKey
    : days.has(yesterday)
      ? yesterday
      : null;

  if (!cursor) return 0;

  let streak = 0;
  while (cursor && days.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }
  return streak;
}

export function calculatePracticeStreak(sessions: PracticeSessionInput[], timeZone: string, now: string | Date = new Date()): number {
  const days = sessions
    .filter(isMeaningfulPracticeSession)
    .map((session) => localDateKey(session.endedAt, timeZone));
  return calculateDateKeyStreak(days, localDateKey(now, timeZone));
}
export function normalizeVocabularyTerm(term: string): string {
  return term.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
export function uniqueVocabularyTerms(terms: string[]): string[] {
  return [...new Set(terms.map(normalizeVocabularyTerm).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
export function aggregateCommonMistakes(categories: string[]): MistakeCount[] {
  const counts = new Map<string, number>();
  for (const category of categories) {
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
export function summarizeFluencyTrend(scores: number[]): FluencyTrend {
  const clean = scores.filter((score) => Number.isFinite(score) && score >= 0 && score <= 100);
  if (clean.length === 0) return { current: null, previous: null, delta: null };
  const window = Math.max(1, Math.ceil(clean.length / 2));
  const current = average(clean.slice(-window));
  const previous = average(clean.slice(0, Math.max(0, clean.length - window)));
  return { current, previous, delta: current !== null && previous !== null ? current - previous : null };
}


function safeCount(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function normalizeDashboardSnapshot(input: unknown): DashboardSnapshot {
  const data =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const weeklyPractice = Array.isArray(data.weeklyPractice)
    ? data.weeklyPractice
        .filter(
          (item): item is { date: string; minutes: number } =>
            Boolean(
              item &&
                typeof item === "object" &&
                /^\d{4}-\d{2}-\d{2}$/.test(
                  String((item as Record<string, unknown>).date ?? ""),
                ) &&
                Number.isInteger((item as Record<string, unknown>).minutes) &&
                Number((item as Record<string, unknown>).minutes) >= 0,
            ),
        )
        .map((item) => ({ date: item.date, minutes: item.minutes }))
    : [];

  const commonMistakes = Array.isArray(data.commonMistakes)
    ? data.commonMistakes
        .filter((item): item is { category: string; count: number } => {
          if (!item || typeof item !== "object") return false;
          const row = item as Record<string, unknown>;
          return (
            typeof row.category === "string" &&
            row.category.trim().length > 0 &&
            Number.isInteger(row.count) &&
            Number(row.count) > 0
          );
        })
        .map((item) => ({ category: item.category.trim(), count: item.count }))
    : [];

  const recentLanguages = Array.isArray(data.recentLanguages)
    ? data.recentLanguages.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const recentScores = Array.isArray(data.recentScores)
    ? data.recentScores.filter(
        (value): value is number =>
          Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100,
      )
    : [];

  const practiceDates = Array.isArray(data.practiceDates)
    ? data.practiceDates.filter(
        (value): value is string =>
          typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
      )
    : [];

  return {
    totalMinutes: safeCount(data.totalMinutes),
    completedSessions: safeCount(data.completedSessions),
    sessionsThisWeek: safeCount(data.sessionsThisWeek),
    vocabularyLearned: safeCount(data.vocabularyLearned),
    weeklyPractice,
    commonMistakes,
    recentLanguages,
    recentScores,
    practiceDates,
  };
}
