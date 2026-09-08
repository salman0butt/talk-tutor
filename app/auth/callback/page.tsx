import { AuthCallback } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export default function AuthCallbackPage() {
  return (
    <AuthShell>
      <AuthCallback />
    </AuthShell>
  );
}
