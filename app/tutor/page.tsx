import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import RightSidebar from "@/components/right-sidebar";
import LeftSidebar from "@/components/left-sidebar";
import StatusPanel from "@/components/status-panel";
import ControlsPanel from "@/components/controls-panel";
import VisualizationPanel from "@/components/visualization-panel";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateLearningProfile } from "@/lib/learning/server";
import { ProfileHydrator } from "@/components/learning/profile-hydrator";

export default async function TutorPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/tutor");
  }

  const profile = await getOrCreateLearningProfile();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <ProfileHydrator
        preferredLanguage={profile.preferredLanguage}
        proficiencyLevel={profile.proficiencyLevel}
        preferredVoice={profile.preferredVoice}
      />
      <Navbar userEmail={user.email} />

      <div className="relative flex flex-1 overflow-hidden">
        <div className="hidden h-full w-80 flex-none flex-col border-r lg:flex">
          <LeftSidebar />
        </div>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          <div className="pointer-events-none absolute left-0 right-0 top-4 z-10 flex justify-center">
            <StatusPanel />
          </div>

          <div className="flex h-full w-full flex-1 items-center justify-center">
            <VisualizationPanel />
          </div>

          <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex justify-center px-4 md:bottom-8">
            <div className="pointer-events-auto">
              <ControlsPanel />
            </div>
          </div>
        </main>

        <div className="hidden h-full w-80 flex-none flex-col border-l lg:flex">
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}
