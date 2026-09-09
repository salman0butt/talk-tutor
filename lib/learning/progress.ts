import {
  calculateDateKeyStreak,
  isMeaningfulPracticeSession,
  localDateKey,
  previousDateKey,
  type PracticeSessionInput,
} from "./analytics.ts";

export type ProgressSessionInput = PracticeSessionInput;

export interface PracticeMinutesSummary {
  totalMinutes: number;
  thisWeekMinutes: number;
  thisMonthMinutes: number;
  previousWeekMinutes: number;
  completedSessions: number;
}

export interface StreakSummary {
  current: number;
  longest: number;
  practicedToday: boolean;
  activeDaysThisWeek: number;
  activeDateKeys: string[];
}

export type MistakeTrend = "improving" | "stable" | "needs_practice" | null;

export interface MistakeOccurrence {
  category: string;
  sessionId: string;
  endedAt: string;
}

export interface MistakeTrendSummary {
  category: string;
  count: number;
  affectedSessions: number;
  recentCount: number;
  previousCount: number;
  trend: MistakeTrend;
}

export interface SkillTrendSummary {
  status: "insufficient" | "ready";
  current: number | null;
  baseline: number | null;
  delta: number | null;
  scores: number[];
}

export interface VocabularyProgressInput {
  createdAt: string;
  status: string;
  nextReviewAt: string;
}

export interface VocabularyGrowthSummary {
  saved: number;
  learning: number;
  strong: number;
  newThisWeek: number;
  due: number;
}

function dateFromKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date key.");
  return date;
}

function startOfWeekKey(dateKey: string) {
  const date = dateFromKey(dateKey);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}

function startOfMonthKey(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

function addDaysKey(dateKey: string, days: number) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function completedPracticeSessions(sessions: ProgressSessionInput[]) {
  return sessions.filter(
    (session) =>
      session.status === "completed" &&
      Number.isFinite(session.durationSeconds) &&
      session.durationSeconds >= 0 &&
      Number.isInteger(session.userMessageCount) &&
      session.userMessageCount > 0 &&
      !Number.isNaN(Date.parse(session.endedAt)),
  );
}

function minutesFrom(sessions: ProgressSessionInput[]) {
  return Math.floor(
    sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60,
  );
}

export function calculatePracticeMinutes(
  sessions: ProgressSessionInput[],
  timeZone: string,
  now: string | Date = new Date(),
): PracticeMinutesSummary {
  const today = localDateKey(now, timeZone);
  const weekStart = startOfWeekKey(today);
  const previousWeekStart = addDaysKey(weekStart, -7);
  const monthStart = startOfMonthKey(today);
  const completed = completedPracticeSessions(sessions);

  const withDate = completed.map((session) => ({
    session,
    dateKey: localDateKey(session.endedAt, timeZone),
  }));

  return {
    totalMinutes: minutesFrom(completed),
    thisWeekMinutes: minutesFrom(
      withDate
        .filter(({ dateKey }) => dateKey >= weekStart && dateKey <= today)
        .map(({ session }) => session),
    ),
    thisMonthMinutes: minutesFrom(
      withDate
        .filter(({ dateKey }) => dateKey >= monthStart && dateKey <= today)
        .map(({ session }) => session),
    ),
    previousWeekMinutes: minutesFrom(
      withDate
        .filter(
          ({ dateKey }) => dateKey >= previousWeekStart && dateKey < weekStart,
        )
        .map(({ session }) => session),
    ),
    completedSessions: completed.length,
  };
}

function longestConsecutiveRun(dateKeys: string[]) {
  if (dateKeys.length === 0) return 0;
  const unique = [...new Set(dateKeys)].sort();
  let longest = 1;
  let current = 1;

  for (let index = 1; index < unique.length; index += 1) {
    if (previousDateKey(unique[index]) === unique[index - 1]) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function calculateStreakSummary(
  sessions: ProgressSessionInput[],
  timeZone: string,
  now: string | Date = new Date(),
): StreakSummary {
  const today = localDateKey(now, timeZone);
  const weekStart = startOfWeekKey(today);
  const activeDateKeys = [
    ...new Set(
      sessions
        .filter(isMeaningfulPracticeSession)
        .map((session) => localDateKey(session.endedAt, timeZone)),
    ),
  ].sort();

  return {
    current: calculateDateKeyStreak(activeDateKeys, today),
    longest: longestConsecutiveRun(activeDateKeys),
    practicedToday: activeDateKeys.includes(today),
    activeDaysThisWeek: activeDateKeys.filter(
      (dateKey) => dateKey >= weekStart && dateKey <= today,
    ).length,
    activeDateKeys,
  };
}

export function aggregateMistakeTrends(
  corrections: MistakeOccurrence[],
  timeZone: string,
  now: string | Date = new Date(),
): MistakeTrendSummary[] {
  const today = localDateKey(now, timeZone);
  const recentStart = addDaysKey(today, -6);
  const previousStart = addDaysKey(recentStart, -7);
  const previousEnd = previousDateKey(recentStart);

  const groups = new Map<
    string,
    {
      count: number;
      sessions: Set<string>;
      recentCount: number;
      previousCount: number;
    }
  >();

  for (const correction of corrections) {
    const category = correction.category.trim();
    if (!category || Number.isNaN(Date.parse(correction.endedAt))) continue;
    const row = groups.get(category) ?? {
      count: 0,
      sessions: new Set<string>(),
      recentCount: 0,
      previousCount: 0,
    };
    row.count += 1;
    row.sessions.add(correction.sessionId);
    const dateKey = localDateKey(correction.endedAt, timeZone);
    if (dateKey >= recentStart && dateKey <= today) {
      row.recentCount += 1;
    } else if (dateKey >= previousStart && dateKey <= previousEnd) {
      row.previousCount += 1;
    }
    groups.set(category, row);
  }

  return [...groups.entries()]
    .map(([category, row]) => {
      let trend: MistakeTrend = null;
      if (row.recentCount >= 2 && row.previousCount >= 2) {
        trend =
          row.recentCount < row.previousCount
            ? "improving"
            : row.recentCount > row.previousCount
              ? "needs_practice"
              : "stable";
      }
      return {
        category,
        count: row.count,
        affectedSessions: row.sessions.size,
        recentCount: row.recentCount,
        previousCount: row.previousCount,
        trend,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.affectedSessions - a.affectedSessions ||
        a.category.localeCompare(b.category),
    );
}

export function calculateSkillTrend(scores: number[]): SkillTrendSummary {
  const clean = scores.filter(
    (score) => Number.isInteger(score) && score >= 0 && score <= 100,
  );
  if (clean.length < 3) {
    return {
      status: "insufficient",
      current: null,
      baseline: null,
      delta: null,
      scores: clean,
    };
  }

  const baseline = clean[0];
  const current = clean.at(-1) ?? baseline;
  return {
    status: "ready",
    current,
    baseline,
    delta: current - baseline,
    scores: clean,
  };
}

export function calculateVocabularyGrowth(
  items: VocabularyProgressInput[],
  timeZone: string,
  now: string | Date = new Date(),
): VocabularyGrowthSummary {
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new Error("Invalid date.");
  const today = localDateKey(nowDate, timeZone);
  const weekStart = startOfWeekKey(today);

  let learning = 0;
  let strong = 0;
  let newThisWeek = 0;
  let due = 0;

  for (const item of items) {
    if (item.status === "strong") strong += 1;
    else learning += 1;

    if (!Number.isNaN(Date.parse(item.createdAt))) {
      const createdKey = localDateKey(item.createdAt, timeZone);
      if (createdKey >= weekStart && createdKey <= today) newThisWeek += 1;
    }

    const next = new Date(item.nextReviewAt);
    if (!Number.isNaN(next.getTime()) && next.getTime() <= nowDate.getTime()) {
      due += 1;
    }
  }

  return {
    saved: items.length,
    learning,
    strong,
    newThisWeek,
    due,
  };
}
