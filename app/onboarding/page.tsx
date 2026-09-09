import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateLearningProfile } from "@/lib/learning/server";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const profile = await getOrCreateLearningProfile();
  if (profile.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  const firstName =
    user.user_metadata?.full_name?.trim().split(/\s+/)[0] ??
    user.user_metadata?.name?.trim().split(/\s+/)[0] ??
    "";

  return (
    <main className="min-h-dvh bg-[#08090d] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold text-amber-400">Talk Tutor</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {firstName ? `Welcome, ${firstName}.` : "Set up your first practice."}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/45">
            Three short steps choose a goal, estimate a starting level, and
            prepare a useful first conversation.
          </p>
        </div>

        <OnboardingFlow />
      </div>
    </main>
  );
}
