import { NextResponse } from "next/server";
import { LearningAuthenticationError, requireLearningRepository } from "@/lib/learning/server";
import { isUuid, parseFinalTranscriptMessage } from "@/lib/learning/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  let message;
  try {
    message = parseFinalTranscriptMessage(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid transcript message." },
      { status: 400 },
    );
  }

  try {
    const repository = await requireLearningRepository();
    await repository.appendMessage(sessionId, message);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Could not save transcript message." },
      { status: 503 },
    );
  }
}
