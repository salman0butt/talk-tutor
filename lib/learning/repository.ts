import type {
  DashboardSnapshot,
  FinalTranscriptMessage,
  LearningProfile,
  LearningProfilePatch,
  LearningSessionSummary,
  SessionFeedback,
  SessionStartInput,
} from "@/lib/learning/types";
import { normalizeDashboardSnapshot } from "@/lib/learning/analytics";
import type {
  SavedVocabularyItem,
  VocabularyExample,
  VocabularyOverview,
} from "@/lib/learning/vocabulary";
import { ownedSessionFilter, withAuthenticatedOwner } from "@/lib/learning/ownership";
import { isUuid } from "@/lib/learning/validation";
import { readSupabaseJson, supabaseRestFetch } from "@/lib/supabase/rest";

type ProfileRow = {
  id: string;
  preferred_language: string;
  proficiency_level: string;
  preferred_voice: string;
  learning_goal: LearningProfile["learningGoal"];
  daily_practice_target_minutes: number;
  timezone: string;
  correction_frequency: LearningProfile["correctionFrequency"];
  conversation_difficulty: LearningProfile["conversationDifficulty"];
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  language: string;
  proficiency_level: string;
  topic: string;
  assistant_voice: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: LearningSessionSummary["status"];
  feedback_status: LearningSessionSummary["feedbackStatus"];
  practice_mode?: LearningSessionSummary["practiceMode"];
  correction_frequency?: LearningSessionSummary["correctionFrequency"];
  conversation_difficulty?: LearningSessionSummary["conversationDifficulty"];
  scenario_id?: string | null;
  custom_scenario?: string | null;
  learner_role?: string | null;
  tutor_role?: string | null;
  target_mistake_categories?: LearningSessionSummary["targetMistakeCategories"];
};


type VocabularyRow = {
  id: string;
  term: string;
  normalized_term: string;
  language: string;
  meaning: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  personalized_example: string | null;
  personalized_explanation: string | null;
  personalized_example_mistake_category: SavedVocabularyItem["personalizedExampleMistakeCategory"];
  source_session_id: string | null;
  source_context: string | null;
  status: SavedVocabularyItem["status"];
  ease_factor: number | string;
  interval_days: number;
  repetition_count: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type VocabularyOverviewRow = {
  saved?: unknown;
  learning?: unknown;
  strong?: unknown;
  due?: unknown;
  nextDueAt?: unknown;
  recent?: unknown;
};

type FeedbackRow = {
  session_id: string;
  summary: string;
  grammar_corrections: SessionFeedback["grammarCorrections"];
  better_sentences: SessionFeedback["betterSentences"];
  vocabulary: SessionFeedback["vocabulary"];
  fluency: SessionFeedback["fluency"];
  pronunciation_notes: unknown[];
  next_steps: SessionFeedback["nextSteps"];
};

export type StartLearningSessionInput = SessionStartInput;

export type FinalizedSession = {
  id: string;
  status: string;
  endedAt: string | null;
  durationSeconds: number;
  feedbackStatus: string;
  userMessageCount: number;
};

function mapProfile(row: ProfileRow): LearningProfile {
  return {
    id: row.id,
    preferredLanguage: row.preferred_language,
    proficiencyLevel: row.proficiency_level,
    preferredVoice: row.preferred_voice,
    learningGoal: row.learning_goal,
    dailyPracticeTargetMinutes: row.daily_practice_target_minutes,
    timezone: row.timezone,
    correctionFrequency: row.correction_frequency,
    conversationDifficulty: row.conversation_difficulty,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSession(row: SessionRow): LearningSessionSummary {
  return {
    id: row.id,
    language: row.language,
    proficiencyLevel: row.proficiency_level,
    topic: row.topic,
    assistantVoice: row.assistant_voice,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    status: row.status,
    feedbackStatus: row.feedback_status,
    practiceMode: row.practice_mode,
    correctionFrequency: row.correction_frequency,
    conversationDifficulty: row.conversation_difficulty,
    scenarioId: row.scenario_id ?? null,
    customScenario: row.custom_scenario ?? null,
    learnerRole: row.learner_role ?? null,
    tutorRole: row.tutor_role ?? null,
    targetMistakeCategories: row.target_mistake_categories ?? [],
    userMessageCount: 0,
  };
}


function mapVocabulary(row: VocabularyRow): SavedVocabularyItem {
  return {
    id: row.id,
    term: row.term,
    normalizedTerm: row.normalized_term,
    language: row.language,
    meaning: row.meaning,
    partOfSpeech: row.part_of_speech,
    exampleSentence: row.example_sentence,
    personalizedExample: row.personalized_example,
    personalizedExplanation: row.personalized_explanation,
    personalizedExampleMistakeCategory:
      row.personalized_example_mistake_category,
    sourceSessionId: row.source_session_id,
    sourceContext: row.source_context,
    status: row.status,
    easeFactor: Number(row.ease_factor),
    intervalDays: row.interval_days,
    repetitionCount: row.repetition_count,
    nextReviewAt: row.next_review_at,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeOverviewCount(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function normalizeVocabularyOverview(input: VocabularyOverviewRow): VocabularyOverview {
  const recent = Array.isArray(input.recent)
    ? input.recent
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object" && !Array.isArray(item)),
        )
        .filter(
          (item) =>
            typeof item.id === "string" &&
            typeof item.term === "string" &&
            typeof item.language === "string" &&
            typeof item.meaning === "string" &&
            (item.status === "learning" || item.status === "strong") &&
            typeof item.nextReviewAt === "string" &&
            typeof item.createdAt === "string",
        )
        .map((item) => ({
          id: item.id as string,
          term: item.term as string,
          language: item.language as string,
          meaning: item.meaning as string,
          status: item.status as SavedVocabularyItem["status"],
          nextReviewAt: item.nextReviewAt as string,
          createdAt: item.createdAt as string,
        }))
    : [];

  return {
    saved: safeOverviewCount(input.saved),
    learning: safeOverviewCount(input.learning),
    strong: safeOverviewCount(input.strong),
    due: safeOverviewCount(input.due),
    nextDueAt:
      typeof input.nextDueAt === "string" && !Number.isNaN(Date.parse(input.nextDueAt))
        ? input.nextDueAt
        : null,
    recent,
  };
}

function mapFeedback(row: FeedbackRow): SessionFeedback {
  return {
    summary: row.summary,
    grammarCorrections: row.grammar_corrections,
    betterSentences: row.better_sentences,
    vocabulary: row.vocabulary,
    fluency: row.fluency,
    pronunciationNotes: [],
    nextSteps: row.next_steps,
  };
}

function profilePatchRow(patch: LearningProfilePatch) {
  return {
    ...(patch.preferredLanguage !== undefined ? { preferred_language: patch.preferredLanguage } : {}),
    ...(patch.proficiencyLevel !== undefined ? { proficiency_level: patch.proficiencyLevel } : {}),
    ...(patch.preferredVoice !== undefined ? { preferred_voice: patch.preferredVoice } : {}),
    ...(patch.learningGoal !== undefined ? { learning_goal: patch.learningGoal } : {}),
    ...(patch.dailyPracticeTargetMinutes !== undefined ? { daily_practice_target_minutes: patch.dailyPracticeTargetMinutes } : {}),
    ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
    ...(patch.correctionFrequency !== undefined ? { correction_frequency: patch.correctionFrequency } : {}),
    ...(patch.conversationDifficulty !== undefined ? { conversation_difficulty: patch.conversationDifficulty } : {}),
    updated_at: new Date().toISOString(),
  };
}

function inFilter(ids: string[]) {
  const safe = ids.filter(isUuid);
  return safe.length ? `in.(${safe.join(",")})` : "in.()";
}

export class LearningRepository {
  constructor(
    private readonly userId: string,
    private readonly accessToken: string,
  ) {}

  async getProfile(): Promise<LearningProfile | null> {
    const response = await supabaseRestFetch(
      `profiles?select=*&id=eq.${this.userId}&limit=1`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<ProfileRow[]>(response);
    return rows[0] ? mapProfile(rows[0]) : null;
  }

  async ensureProfile(): Promise<LearningProfile> {
    const existing = await this.getProfile();
    if (existing) return existing;

    const response = await supabaseRestFetch(
      "profiles?on_conflict=id",
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ id: this.userId }),
        prefer: "resolution=ignore-duplicates,return=representation",
      },
    );
    const rows = await readSupabaseJson<ProfileRow[]>(response);
    if (rows[0]) return mapProfile(rows[0]);

    const profile = await this.getProfile();
    if (!profile) throw new Error("Profile creation failed.");
    return profile;
  }

  async patchProfile(patch: LearningProfilePatch): Promise<LearningProfile> {
    await this.ensureProfile();
    const response = await supabaseRestFetch(
      `profiles?id=eq.${this.userId}`,
      this.accessToken,
      {
        method: "PATCH",
        body: JSON.stringify(profilePatchRow(patch)),
        prefer: "return=representation",
      },
    );
    const rows = await readSupabaseJson<ProfileRow[]>(response);
    if (!rows[0]) throw new Error("Profile update failed.");
    return mapProfile(rows[0]);
  }

  async startSession(input: StartLearningSessionInput): Promise<string> {
    const response = await supabaseRestFetch("rpc/start_learning_session", this.accessToken, {
      method: "POST",
      body: JSON.stringify({
        p_language: input.language,
        p_proficiency_level: input.proficiencyLevel,
        p_topic: input.topic,
        p_assistant_voice: input.assistantVoice,
        p_messages: input.messages,
        p_practice_mode: input.practiceMode,
        p_scenario_id: input.scenarioId ?? null,
        p_custom_scenario: input.customScenario ?? null,
        p_learner_role: input.learnerRole ?? null,
        p_tutor_role: input.tutorRole ?? null,
        p_target_mistake_categories: input.targetMistakeCategories,
        p_correction_frequency: input.correctionFrequency,
        p_conversation_difficulty: input.difficulty,
      }),
    });
    const id = await readSupabaseJson<string>(response);
    if (!isUuid(id)) throw new Error("Session creation returned an invalid id.");
    return id;
  }

  async appendMessage(sessionId: string, message: FinalTranscriptMessage): Promise<void> {
    const filter = ownedSessionFilter(this.userId, sessionId);
    void filter;
    const response = await supabaseRestFetch("rpc/append_learning_message", this.accessToken, {
      method: "POST",
      body: JSON.stringify({
        p_session_id: sessionId,
        p_role: message.role,
        p_sequence: message.sequence,
        p_text: message.text,
        p_occurred_at: message.occurredAt,
      }),
    });
    await readSupabaseJson<string | null>(response);
  }

  async finalizeSession(sessionId: string): Promise<FinalizedSession> {
    ownedSessionFilter(this.userId, sessionId);
    const response = await supabaseRestFetch("rpc/finalize_learning_session", this.accessToken, {
      method: "POST",
      body: JSON.stringify({ p_session_id: sessionId }),
    });
    return readSupabaseJson<FinalizedSession>(response);
  }

  async listSessions(limit = 30): Promise<LearningSessionSummary[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const response = await supabaseRestFetch(
      `learning_sessions?select=id,language,proficiency_level,topic,assistant_voice,started_at,ended_at,duration_seconds,status,feedback_status,practice_mode,correction_frequency,conversation_difficulty,scenario_id,custom_scenario,learner_role,tutor_role,target_mistake_categories&user_id=eq.${this.userId}&status=eq.completed&order=ended_at.desc.nullslast&limit=${safeLimit}`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<SessionRow[]>(response);
    const sessions = rows.map(mapSession);
    const ids = sessions.map((session) => session.id);
    if (ids.length === 0) return sessions;

    const [feedbackResponse, countResponse] = await Promise.all([
      supabaseRestFetch(
        `session_feedback?select=session_id,summary,fluency&user_id=eq.${this.userId}&session_id=${inFilter(ids)}`,
        this.accessToken,
      ),
      supabaseRestFetch(
        `session_messages?select=session_id,role&user_id=eq.${this.userId}&role=eq.user&session_id=${inFilter(ids)}`,
        this.accessToken,
      ),
    ]);

    const feedbackRows = await readSupabaseJson<Array<Pick<FeedbackRow, "session_id" | "summary" | "fluency">>>(feedbackResponse);
    const messageRows = await readSupabaseJson<Array<{ session_id: string }>>(countResponse);
    const feedback = new Map(feedbackRows.map((row) => [row.session_id, row]));
    const counts = new Map<string, number>();
    for (const row of messageRows) counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);

    return sessions.map((session) => ({
      ...session,
      userMessageCount: counts.get(session.id) ?? 0,
      feedbackSummary: feedback.get(session.id)?.summary ?? null,
      fluencyScore: feedback.get(session.id)?.fluency?.score ?? null,
    }));
  }

  async getSession(sessionId: string): Promise<LearningSessionSummary | null> {
    const filter = ownedSessionFilter(this.userId, sessionId);
    const response = await supabaseRestFetch(
      `learning_sessions?select=id,language,proficiency_level,topic,assistant_voice,started_at,ended_at,duration_seconds,status,feedback_status,practice_mode,correction_frequency,conversation_difficulty,scenario_id,custom_scenario,learner_role,tutor_role,target_mistake_categories&${new URLSearchParams(filter).toString()}&limit=1`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<SessionRow[]>(response);
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async getMessages(sessionId: string): Promise<FinalTranscriptMessage[]> {
    ownedSessionFilter(this.userId, sessionId);
    const response = await supabaseRestFetch(
      `session_messages?select=role,text,sequence,occurred_at&user_id=eq.${this.userId}&session_id=eq.${sessionId}&order=sequence.asc`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<Array<{ role: "user" | "assistant"; text: string; sequence: number; occurred_at: string }>>(response);
    return rows.map((row) => ({
      role: row.role,
      text: row.text,
      sequence: row.sequence,
      occurredAt: row.occurred_at,
    }));
  }

  async getFeedback(sessionId: string): Promise<SessionFeedback | null> {
    ownedSessionFilter(this.userId, sessionId);
    const response = await supabaseRestFetch(
      `session_feedback?select=session_id,summary,grammar_corrections,better_sentences,vocabulary,fluency,pronunciation_notes,next_steps&user_id=eq.${this.userId}&session_id=eq.${sessionId}&limit=1`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<FeedbackRow[]>(response);
    return rows[0] ? mapFeedback(rows[0]) : null;
  }

  async saveFeedback(sessionId: string, feedback: SessionFeedback): Promise<void> {
    ownedSessionFilter(this.userId, sessionId);
    const row = withAuthenticatedOwner(this.userId, {
      session_id: sessionId,
      summary: feedback.summary,
      grammar_corrections: feedback.grammarCorrections,
      better_sentences: feedback.betterSentences,
      vocabulary: feedback.vocabulary,
      fluency: feedback.fluency,
      pronunciation_notes: [],
      next_steps: feedback.nextSteps,
      updated_at: new Date().toISOString(),
    });
    const response = await supabaseRestFetch(
      "session_feedback?on_conflict=session_id",
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify(row),
        prefer: "resolution=merge-duplicates,return=minimal",
      },
    );
    if (!response.ok) await readSupabaseJson(response);
  }

  async claimFeedbackGeneration(sessionId: string): Promise<boolean> {
    ownedSessionFilter(this.userId, sessionId);
    const response = await supabaseRestFetch(
      `learning_sessions?id=eq.${sessionId}&user_id=eq.${this.userId}&status=eq.completed&feedback_status=in.(pending,failed)`,
      this.accessToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          feedback_status: "processing",
          updated_at: new Date().toISOString(),
        }),
        prefer: "return=representation",
      },
    );
    const rows = await readSupabaseJson<Array<{ id: string }>>(response);
    return rows.length === 1;
  }

  async setFeedbackStatus(sessionId: string, status: LearningSessionSummary["feedbackStatus"]): Promise<void> {
    ownedSessionFilter(this.userId, sessionId);
    const response = await supabaseRestFetch(
      `learning_sessions?id=eq.${sessionId}&user_id=eq.${this.userId}`,
      this.accessToken,
      {
        method: "PATCH",
        body: JSON.stringify({ feedback_status: status, updated_at: new Date().toISOString() }),
        prefer: "return=minimal",
      },
    );
    if (!response.ok) await readSupabaseJson(response);
  }


  async getVocabularyOverview(): Promise<VocabularyOverview> {
    const response = await supabaseRestFetch(
      "rpc/get_vocabulary_overview",
      this.accessToken,
      { method: "POST", body: "{}" },
    );
    const payload = await readSupabaseJson<VocabularyOverviewRow>(response);
    return normalizeVocabularyOverview(payload ?? {});
  }

  async listVocabularyItems(limit = 100): Promise<SavedVocabularyItem[]> {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const response = await supabaseRestFetch(
      `vocabulary_items?select=*&user_id=eq.${this.userId}&order=created_at.desc&limit=${safeLimit}`,
      this.accessToken,
    );
    return (await readSupabaseJson<VocabularyRow[]>(response)).map(mapVocabulary);
  }

  async listDueVocabulary(limit = 50): Promise<SavedVocabularyItem[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const now = encodeURIComponent(new Date().toISOString());
    const response = await supabaseRestFetch(
      `vocabulary_items?select=*&user_id=eq.${this.userId}&next_review_at=lte.${now}&order=next_review_at.asc,created_at.asc&limit=${safeLimit}`,
      this.accessToken,
    );
    return (await readSupabaseJson<VocabularyRow[]>(response)).map(mapVocabulary);
  }

  async getVocabularyItem(itemId: string): Promise<SavedVocabularyItem | null> {
    if (!isUuid(itemId)) return null;
    const response = await supabaseRestFetch(
      `vocabulary_items?select=*&id=eq.${itemId}&user_id=eq.${this.userId}&limit=1`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<VocabularyRow[]>(response);
    return rows[0] ? mapVocabulary(rows[0]) : null;
  }

  async saveVocabularyItem(input: {
    term: string;
    language: string;
    meaning: string;
    partOfSpeech?: string | null;
    exampleSentence?: string | null;
    sourceSessionId?: string | null;
    sourceContext?: string | null;
  }): Promise<string> {
    const response = await supabaseRestFetch(
      "rpc/save_vocabulary_item",
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          p_term: input.term,
          p_language: input.language,
          p_meaning: input.meaning,
          p_part_of_speech: input.partOfSpeech ?? null,
          p_example_sentence: input.exampleSentence ?? null,
          p_source_session_id: input.sourceSessionId ?? null,
          p_source_context: input.sourceContext ?? null,
        }),
      },
    );
    const id = await readSupabaseJson<string>(response);
    if (!isUuid(id)) throw new Error("Vocabulary save returned an invalid id.");
    return id;
  }

  async deleteVocabularyItem(itemId: string): Promise<void> {
    if (!isUuid(itemId)) throw new Error("Invalid vocabulary item id.");
    const response = await supabaseRestFetch(
      `vocabulary_items?id=eq.${itemId}&user_id=eq.${this.userId}`,
      this.accessToken,
      { method: "DELETE", prefer: "return=minimal" },
    );
    if (!response.ok) await readSupabaseJson(response);
  }

  async reviewVocabularyItem(
    itemId: string,
    rating: string,
    next: {
      easeFactor: number;
      intervalDays: number;
      repetitionCount: number;
      status: string;
      nextReviewAt: string;
      lastReviewedAt: string;
    },
  ): Promise<unknown> {
    if (!isUuid(itemId)) throw new Error("Invalid vocabulary item id.");
    const response = await supabaseRestFetch(
      "rpc/review_vocabulary_item",
      this.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          p_item_id: itemId,
          p_rating: rating,
          p_ease_factor: next.easeFactor,
          p_interval_days: next.intervalDays,
          p_repetition_count: next.repetitionCount,
          p_status: next.status,
          p_next_review_at: next.nextReviewAt,
          p_reviewed_at: next.lastReviewedAt,
        }),
      },
    );
    return readSupabaseJson(response);
  }

  async saveVocabularyExample(
    itemId: string,
    example: VocabularyExample,
  ): Promise<void> {
    if (!isUuid(itemId)) throw new Error("Invalid vocabulary item id.");
    const response = await supabaseRestFetch(
      `vocabulary_items?id=eq.${itemId}&user_id=eq.${this.userId}&personalized_example=is.null`,
      this.accessToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          personalized_example: example.sentence,
          personalized_explanation: example.explanation ?? null,
          personalized_example_mistake_category:
            example.targetMistakeCategory ?? null,
          updated_at: new Date().toISOString(),
        }),
        prefer: "return=minimal",
      },
    );
    if (!response.ok) await readSupabaseJson(response);
  }

  async getRecentMistakeContext(): Promise<{
    category: SessionFeedback["grammarCorrections"][number]["category"];
    original: string;
    corrected: string;
  } | null> {
    const response = await supabaseRestFetch(
      `session_feedback?select=grammar_corrections,created_at&user_id=eq.${this.userId}&order=created_at.desc&limit=12`,
      this.accessToken,
    );
    const rows = await readSupabaseJson<
      Array<{
        grammar_corrections: SessionFeedback["grammarCorrections"];
        created_at: string;
      }>
    >(response);
    for (const row of rows) {
      const correction = row.grammar_corrections?.[0];
      if (correction) {
        return {
          category: correction.category,
          original: correction.original,
          corrected: correction.corrected,
        };
      }
    }
    return null;
  }

  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    const response = await supabaseRestFetch("rpc/get_learning_dashboard", this.accessToken, {
      method: "POST",
      body: "{}",
    });
    const payload = await readSupabaseJson<unknown>(response);
    return normalizeDashboardSnapshot(payload);
  }
}
