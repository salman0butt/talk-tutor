import { NextResponse } from "next/server";
import { FeedbackService } from "@/lib/learning/feedback/service";
import { GeminiFeedbackProvider } from "@/lib/learning/feedback/provider";
import {
  LearningAuthenticationError,
  requireLearningRepository,
} from "@/lib/learning/server";
import { isUuid } from "@/lib/learning/validation";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;

  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "Invalid session id." }, { status: 400 });
  }

  try {
    const repository = await requireLearningRepository();
    const service = new FeedbackService(repository, new GeminiFeedbackProvider());
    const result = await service.generate(sessionId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Feedback could not be generated. You can retry from session history." },
      { status: 503 },
    );
  }
}
