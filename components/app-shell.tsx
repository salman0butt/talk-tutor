import { AppNav } from "@/components/app-nav";

export function AppShell({
  children,
  displayName,
}: {
  children: React.ReactNode;
  displayName?: string;
}) {
  return (
    <div className="min-h-dvh bg-[#08090d] text-white">
      <AppNav displayName={displayName} />
      <main className="mx-auto w-full max-w-7xl px-5 py-8 pb-24 sm:px-8 lg:px-10 lg:py-10 md:pb-10">
        {children}
      </main>
    </div>
  );
}
