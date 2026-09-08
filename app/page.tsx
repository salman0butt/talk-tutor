import { LandingPage } from "@/components/landing-page";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  return <LandingPage isAuthenticated={Boolean(user)} />;
}
