import { parsePracticeConfiguration } from "./practice.ts";
import {
  GRAMMAR_CATEGORIES,
  LEARNING_GOALS,
  type BetterSentence,
  type FinalTranscriptMessage,
  type GrammarCorrection,
  type LearningProfilePatch,
  type SessionFeedback,
  type VocabularyItem,
} from "./types.ts";

const LANGUAGES = new Set(["en-US","en-GB","es-ES","es-MX","fr-FR","de-DE","ja-JP","ko-KR","zh-CN","hi-IN","pt-BR"]);
const LEVELS = new Set(["Basic","Intermediate","Top Class"]);
const VOICES = new Set(["Charon","Puck","Kore","Fenrir","Aoede"]);
const GOALS = new Set(LEARNING_GOALS);
const CATEGORIES = new Set(GRAMMAR_CATEGORIES);
const CORRECTION_FREQUENCIES = new Set(["minimal", "balanced", "frequent"]);
const CONVERSATION_DIFFICULTIES = new Set(["easy", "normal", "challenging"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asRecord(value: unknown, label = "value"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, field: string, maxLength = 4000): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const text = value.trim();
  if (!text) throw new Error(`${field} cannot be empty.`);
  if (text.length > maxLength) throw new Error(`${field} is too long.`);
  return text;
}
function optionalString(value: unknown, field: string, maxLength = 4000): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, field, maxLength);
}
function ensureArray(value: unknown, field: string, maxLength: number): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  if (value.length > maxLength) throw new Error(`${field} has too many items.`);
  return value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
export function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value.length <= 64;
  } catch {
    return false;
  }
}
export function parseProfilePatch(input: unknown): LearningProfilePatch {
  const data = asRecord(input, "Profile update");
  const result: LearningProfilePatch = {};
  if ("preferredLanguage" in data) {
    const value = requiredString(data.preferredLanguage, "Preferred language", 16);
    if (!LANGUAGES.has(value)) throw new Error("Unsupported preferred language.");
    result.preferredLanguage = value;
  }
  if ("proficiencyLevel" in data) {
    const value = requiredString(data.proficiencyLevel, "Proficiency level", 32);
    if (!LEVELS.has(value)) throw new Error("Unsupported proficiency level.");
    result.proficiencyLevel = value;
  }
  if ("preferredVoice" in data) {
    const value = requiredString(data.preferredVoice, "Preferred voice", 32);
    if (!VOICES.has(value)) throw new Error("Unsupported preferred voice.");
    result.preferredVoice = value;
  }
  if ("learningGoal" in data) {
    const value = requiredString(data.learningGoal, "Learning goal", 40);
    if (!GOALS.has(value as never)) throw new Error("Unsupported learning goal.");
    result.learningGoal = value as LearningProfilePatch["learningGoal"];
  }
  if ("dailyPracticeTargetMinutes" in data) {
    const value = data.dailyPracticeTargetMinutes;
    if (!Number.isInteger(value) || Number(value) < 5 || Number(value) > 180) {
      throw new Error("Daily practice target must be an integer from 5 to 180 minutes.");
    }
    result.dailyPracticeTargetMinutes = Number(value);
  }
  if ("timezone" in data) {
    const value = requiredString(data.timezone, "Timezone", 64);
    if (!isIanaTimezone(value)) throw new Error("Timezone must be a valid IANA timezone.");
    result.timezone = value;
  }
  if ("correctionFrequency" in data) {
    const value = requiredString(data.correctionFrequency, "Correction frequency", 24);
    if (!CORRECTION_FREQUENCIES.has(value)) throw new Error("Unsupported correction frequency.");
    result.correctionFrequency = value as LearningProfilePatch["correctionFrequency"];
  }
  if ("conversationDifficulty" in data) {
    const value = requiredString(data.conversationDifficulty, "Conversation difficulty", 24);
    if (!CONVERSATION_DIFFICULTIES.has(value)) throw new Error("Unsupported conversation difficulty.");
    result.conversationDifficulty = value as LearningProfilePatch["conversationDifficulty"];
  }
  if (Object.keys(result).length === 0) throw new Error("Provide at least one profile field to update.");
  return result;
}
export function parseFinalTranscriptMessage(input: unknown): FinalTranscriptMessage {
  const data = asRecord(input, "Transcript message");
  if (data.role !== "user" && data.role !== "assistant") throw new Error("Transcript role must be user or assistant.");
  const text = requiredString(data.text, "Transcript text", 12000);
  if (!Number.isInteger(data.sequence) || Number(data.sequence) < 0 || Number(data.sequence) > 10000) {
    throw new Error("Transcript sequence must be a non-negative integer.");
  }
  const occurredAt = data.occurredAt === undefined ? new Date().toISOString() : requiredString(data.occurredAt, "Transcript occurredAt", 64);
  if (Number.isNaN(Date.parse(occurredAt))) throw new Error("Transcript occurredAt must be a valid date.");
  return { role: data.role, text, sequence: Number(data.sequence), occurredAt };
}
function parseGrammarCorrection(value: unknown): GrammarCorrection {
  const data = asRecord(value, "Grammar correction");
  const category = requiredString(data.category, "Grammar correction category", 32);
  if (!CATEGORIES.has(category as never)) throw new Error("Unsupported grammar correction category.");
  if (
    !Number.isInteger(data.sourceSequence) ||
    Number(data.sourceSequence) < 0 ||
    Number(data.sourceSequence) > 10000
  ) {
    throw new Error(
      "Grammar correction sourceSequence must identify a learner transcript turn.",
    );
  }
  return {
    sourceSequence: Number(data.sourceSequence),
    original: requiredString(data.original, "Grammar correction original"),
    corrected: requiredString(data.corrected, "Grammar correction corrected"),
    explanation: requiredString(data.explanation, "Grammar correction explanation"),
    category: category as GrammarCorrection["category"],
  };
}
function parseBetterSentence(value: unknown): BetterSentence {
  const data = asRecord(value, "Better sentence");
  const reason = optionalString(data.reason, "Better sentence reason");
  return {
    original: requiredString(data.original, "Better sentence original"),
    suggestion: requiredString(data.suggestion, "Better sentence suggestion"),
    ...(reason ? { reason } : {}),
  };
}
function parseVocabulary(value: unknown): VocabularyItem {
  const data = asRecord(value, "Vocabulary item");
  const example = optionalString(data.example, "Vocabulary example");
  return {
    term: requiredString(data.term, "Vocabulary term", 200),
    meaning: requiredString(data.meaning, "Vocabulary meaning", 1000),
    ...(example ? { example } : {}),
  };
}
export function parseSessionFeedback(input: unknown): SessionFeedback {
  const data = asRecord(input, "Session feedback");
  const fluency = asRecord(data.fluency, "Fluency");
  if (!Number.isInteger(fluency.score) || Number(fluency.score) < 0 || Number(fluency.score) > 100) {
    throw new Error("Fluency score must be an integer from 0 to 100.");
  }
  return {
    summary: requiredString(data.summary, "Feedback summary", 4000),
    grammarCorrections: ensureArray(data.grammarCorrections, "grammarCorrections", 30).map(parseGrammarCorrection),
    betterSentences: ensureArray(data.betterSentences, "betterSentences", 30).map(parseBetterSentence),
    vocabulary: ensureArray(data.vocabulary, "vocabulary", 50).map(parseVocabulary),
    fluency: { score: Number(fluency.score), summary: requiredString(fluency.summary, "Fluency summary", 3000) },
    pronunciationNotes: [],
    nextSteps: ensureArray(data.nextSteps, "nextSteps", 12).map((item) => requiredString(item, "Next step", 500)),
  };
}

export function parseStartSessionInput(input: unknown) {
  const data = asRecord(input, "Session start");
  const language = requiredString(data.language, "Language", 16);
  if (!LANGUAGES.has(language)) throw new Error("Unsupported session language.");
  const proficiencyLevel = requiredString(data.proficiencyLevel, "Proficiency level", 32);
  if (!LEVELS.has(proficiencyLevel)) throw new Error("Unsupported proficiency level.");
  const assistantVoice = requiredString(data.assistantVoice, "Assistant voice", 32);
  if (!VOICES.has(assistantVoice)) throw new Error("Unsupported assistant voice.");

  const practice = parsePracticeConfiguration({
    practiceMode: data.practiceMode,
    topic: data.topic,
    scenarioId: data.scenarioId,
    customScenario: data.customScenario,
    learnerRole: data.learnerRole,
    tutorRole: data.tutorRole,
    correctionFrequency: data.correctionFrequency,
    difficulty: data.difficulty,
    targetMistakeCategories: data.targetMistakeCategories,
  });

  const rawMessages = ensureArray(data.messages, "messages", 20);
  const messages = rawMessages.map(parseFinalTranscriptMessage);
  if (!messages.some((message) => message.role === "user")) {
    throw new Error("A finalized user message is required to start a session.");
  }
  return { language, proficiencyLevel, assistantVoice, ...practice, messages };
}
