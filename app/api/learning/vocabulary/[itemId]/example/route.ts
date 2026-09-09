import { NextResponse } from "next/server";
import {
  LearningAuthenticationError,
  requireLearningRepository,
} from "@/lib/learning/server";
import { isUuid } from "@/lib/learning/validation";
import { VocabularyExampleService } from "@/lib/learning/vocabulary-example/service";
import { GeminiVocabularyExampleProvider } from "@/lib/learning/vocabulary-example/provider";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  if (!isUuid(itemId)) {
    return NextResponse.json({ error: "Invalid vocabulary item." }, { status: 400 });
  }

  try {
    const repository = await requireLearningRepository();
    const profile = await repository.ensureProfile();
    const service = new VocabularyExampleService(
      repository,
      new GeminiVocabularyExampleProvider(),
    );
    const result = await service.generate(itemId, profile.proficiencyLevel);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && /not found/i.test(error.message)) {
      return NextResponse.json({ error: "Vocabulary item not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Could not generate a personalized example." },
      { status: 503 },
    );
  }
}
