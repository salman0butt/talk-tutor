import { NextResponse } from "next/server";
import {
  LearningAuthenticationError,
  requireLearningRepository,
} from "@/lib/learning/server";
import { parseOnboardingSubmission } from "@/lib/onboarding/submission";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  let submission;
  try {
    submission = parseOnboardingSubmission(body);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid onboarding submission.",
      },
      { status: 400 },
    );
  }

  try {
    const repository = await requireLearningRepository();
    const profile = await repository.completeOnboarding(submission);
    const params = new URLSearchParams({
      mode: submission.recommendation.practiceMode,
      topic: submission.recommendation.topic,
    });
    if (submission.recommendation.scenarioId) {
      params.set("scenario", submission.recommendation.scenarioId);
    }

    return NextResponse.json({
      profile,
      placement: {
        score: submission.score,
        recommendedLevel: submission.recommendedLevel,
        selectedLevel: submission.selectedLevel,
      },
      tutorHref: `/tutor?${params.toString()}`,
    });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Onboarding could not be completed." },
      { status: 503 },
    );
  }
}
