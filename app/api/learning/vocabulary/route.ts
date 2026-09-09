import { NextResponse } from "next/server";
import { AVAILABLE_LANGUAGES } from "@/lib/constants";
import {
  LearningAuthenticationError,
  requireLearningRepository,
} from "@/lib/learning/server";
import { isUuid } from "@/lib/learning/validation";

const LANGUAGE_CODES = new Set(AVAILABLE_LANGUAGES.map((language) => language.code));

function text(
  value: unknown,
  label: string,
  maxLength: number,
  required = false,
) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${label} is required.`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const cleaned = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!cleaned && required) throw new Error(`${label} is required.`);
  if (cleaned.length > maxLength) throw new Error(`${label} is too long.`);
  return cleaned || undefined;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Vocabulary item must be an object.");
    }
    const data = body as Record<string, unknown>;
    const term = text(data.term, "Term", 200, true)!;
    const language = text(data.language, "Language", 16, true)!;
    const meaning = text(data.meaning, "Meaning", 1000, true)!;
    if (!LANGUAGE_CODES.has(language)) throw new Error("Unsupported language.");
    const sourceSessionId = text(data.sourceSessionId, "Source session", 64);
    if (sourceSessionId && !isUuid(sourceSessionId)) {
      throw new Error("Invalid source session.");
    }

    const repository = await requireLearningRepository();
    const itemId = await repository.saveVocabularyItem({
      term,
      language,
      meaning,
      partOfSpeech: text(data.partOfSpeech, "Part of speech", 80),
      exampleSentence: text(data.exampleSentence, "Example sentence", 2000),
      sourceSessionId,
      sourceContext: text(data.sourceContext, "Source context", 4000),
    });

    return NextResponse.json({ itemId }, { status: 201 });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message =
      error instanceof Error ? error.message : "Could not save vocabulary.";
    const isValidation =
      /required|must be|too long|unsupported|invalid/i.test(message);
    return NextResponse.json(
      { error: isValidation ? message : "Could not save vocabulary." },
      { status: isValidation ? 400 : 503 },
    );
  }
}
