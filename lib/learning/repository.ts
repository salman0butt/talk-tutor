import type {
  DashboardSnapshot,
  FinalTranscriptMessage,
  LearningProfile,
  LearningProfilePatch,
  LearningSessionSummary,
  SessionFeedback,
} from "@/lib/learning/types";
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

export type StartLearningSessionInput = {
  language: string;
  proficiencyLevel: string;
  topic: string;
  assistantVoice: string;
  messages: FinalTranscriptMessage[];
};

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
    userMessageCount: 0,
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
      `learning_sessions?select=id,language,proficiency_level,topic,assistant_voice,started_at,ended_at,duration_seconds,status,feedback_status&user_id=eq.${this.userId}&status=eq.completed&order=ended_at.desc.nullslast&limit=${safeLimit}`,
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
      `learning_sessions?select=id,language,proficiency_level,topic,assistant_voice,started_at,ended_at,duration_seconds,status,feedback_status&${new URLSearchParams(filter).toString()}&limit=1`,
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

  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    const response = await supabaseRestFetch("rpc/get_learning_dashboard", this.accessToken, {
      method: "POST",
      body: "{}",
    });
    return readSupabaseJson<DashboardSnapshot>(response);
  }
}
