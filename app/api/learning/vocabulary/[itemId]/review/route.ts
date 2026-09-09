import { NextResponse } from "next/server";
import {
  LearningAuthenticationError,
  requireLearningRepository,
} from "@/lib/learning/server";
import { VOCABULARY_REVIEW_RATINGS } from "@/lib/learning/spaced-repetition";
import { isUuid } from "@/lib/learning/validation";

const RATINGS = new Set<string>(VOCABULARY_REVIEW_RATINGS);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  if (!isUuid(itemId)) {
    return NextResponse.json({ error: "Invalid vocabulary item." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const rating =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).rating
      : null;
  if (typeof rating !== "string" || !RATINGS.has(rating)) {
    return NextResponse.json({ error: "Invalid review rating." }, { status: 400 });
  }

  try {
    const repository = await requireLearningRepository();
    const item = await repository.getVocabularyItem(itemId);
    if (!item) {
      return NextResponse.json({ error: "Vocabulary item not found." }, { status: 404 });
    }

    const review = await repository.reviewVocabularyItem(itemId, rating);
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Could not save vocabulary review." },
      { status: 503 },
    );
  }
}
