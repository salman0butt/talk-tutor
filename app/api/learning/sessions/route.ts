import { NextResponse } from "next/server";
import { LearningAuthenticationError, requireLearningRepository } from "@/lib/learning/server";
import { parseStartSessionInput } from "@/lib/learning/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  let input;
  try {
    input = parseStartSessionInput(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid learning session." },
      { status: 400 },
    );
  }

  try {
    const repository = await requireLearningRepository();
    const sessionId = await repository.startSession(input);
    return NextResponse.json({ sessionId }, { status: 201 });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Could not start learning session." },
      { status: 503 },
    );
  }
}
