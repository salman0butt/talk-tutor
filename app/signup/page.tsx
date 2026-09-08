import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser, isSafeNextPath } from "@/lib/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const nextPath = isSafeNextPath(params.next) ? params.next : "/tutor";

  if (user) redirect(nextPath);

  return (
    <AuthShell>
      <AuthForm mode="signup" nextPath={nextPath} />
    </AuthShell>
  );
}
