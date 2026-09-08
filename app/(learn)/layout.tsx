import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email;

  return <AppShell displayName={displayName}>{children}</AppShell>;
}
