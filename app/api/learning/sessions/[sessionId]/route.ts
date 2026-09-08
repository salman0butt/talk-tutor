import { NextResponse } from "next/server";
import { LearningAuthenticationError, requireLearningRepository } from "@/lib/learning/server";
import { isUuid } from "@/lib/learning/validation";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  try {
    const repository = await requireLearningRepository();
    const session = await repository.finalizeSession(sessionId);
    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Could not finalize learning session." },
      { status: 503 },
    );
  }
}
