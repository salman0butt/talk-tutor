import { NextResponse } from "next/server";
import {
  FeedbackGenerationError,
  FeedbackService,
  type FeedbackFailureCode,
} from "@/lib/learning/feedback/service";
import { GeminiFeedbackProvider } from "@/lib/learning/feedback/provider";
import {
  LearningAuthenticationError,
  requireLearningRepository,
} from "@/lib/learning/server";
import { isUuid } from "@/lib/learning/validation";

const FEEDBACK_ERROR_MESSAGES: Record<FeedbackFailureCode, string> = {
  provider_timeout:
    "Feedback generation timed out. Please retry in a moment.",
  provider_rate_limited:
    "The feedback service is temporarily rate-limited. Please retry shortly.",
  provider_failed:
    "The feedback service is temporarily unavailable. Please retry.",
  invalid_json:
    "The feedback service returned an unreadable response. Please retry.",
  invalid_output:
    "The feedback service returned an invalid response. Please retry.",
  persistence_failed:
    "Feedback was generated but could not be saved. Please retry.",
};

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

    const failure =
      error instanceof FeedbackGenerationError ? error : null;

    console.error("[Session feedback] generation failed", {
      sessionId,
      code: failure?.code ?? "unknown",
      message:
        error instanceof Error ? error.message : "Unknown feedback failure",
    });

    const code = failure?.code ?? "provider_failed";
    return NextResponse.json(
      {
        error: FEEDBACK_ERROR_MESSAGES[code],
        code,
        ...(process.env.NODE_ENV === "development" && error instanceof Error
          ? { detail: error.message }
          : {}),
      },
      { status: 503 },
    );
  }
}
