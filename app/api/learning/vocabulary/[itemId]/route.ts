import { NextResponse } from "next/server";
import {
  LearningAuthenticationError,
  requireLearningRepository,
} from "@/lib/learning/server";
import { isUuid } from "@/lib/learning/validation";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  if (!isUuid(itemId)) {
    return NextResponse.json({ error: "Invalid vocabulary item." }, { status: 400 });
  }

  try {
    const repository = await requireLearningRepository();
    await repository.deleteVocabularyItem(itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Could not remove vocabulary item." },
      { status: 503 },
    );
  }
}
