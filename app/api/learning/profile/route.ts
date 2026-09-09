import { NextResponse } from "next/server";
import { LearningAuthenticationError, requireLearningRepository } from "@/lib/learning/server";
import { parseProfilePatch } from "@/lib/learning/validation";

export async function GET() {
  try {
    const repository = await requireLearningRepository();
    return NextResponse.json({ profile: await repository.ensureProfile() });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not load learning profile." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  let patch;
  try {
    patch = parseProfilePatch(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid profile update." },
      { status: 400 },
    );
  }

  try {
    const repository = await requireLearningRepository();
    return NextResponse.json({ profile: await repository.patchProfile(patch) });
  } catch (error) {
    if (error instanceof LearningAuthenticationError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not save learning profile." }, { status: 503 });
  }
}
