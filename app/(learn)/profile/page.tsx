import { ProfileForm } from "@/components/profile/profile-form";
import { getOrCreateLearningProfile } from "@/lib/learning/server";

export default async function ProfilePage() {
  const profile = await getOrCreateLearningProfile();

  return (
    <div>
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-amber-400">Learning profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Make every practice session start ready.</h1>
        <p className="mt-4 text-sm leading-6 text-white/40 sm:text-base">
          Your tutor defaults, learning goal, and timezone stay attached to your account across devices.
        </p>
      </div>
      <div className="mt-8">
        <ProfileForm initialProfile={profile} />
      </div>
    </div>
  );
}
