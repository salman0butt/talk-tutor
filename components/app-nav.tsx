"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenText, CreditCard, LibraryBig, LogOut, Mic2, UserRound } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/tutor", label: "Practice", icon: Mic2 },
  { href: "/history", label: "History", icon: BookOpenText },
  { href: "/vocabulary", label: "Vocabulary", icon: LibraryBig },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function AppNav({ displayName }: { displayName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#08090d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 sm:px-8 lg:px-10">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/logo-tutor.png" alt="Talk Tutor" width={36} height={36} className="rounded-lg" priority />
            <span className="hidden font-semibold tracking-tight sm:inline">
              Talk <span className="text-amber-400">Tutor</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Learning navigation">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                    active ? "bg-amber-300/10 text-amber-200" : "text-white/45 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {displayName && <span className="hidden max-w-44 truncate text-xs text-white/35 lg:block">{displayName}</span>}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-50"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-6 rounded-2xl border border-white/10 bg-[#111218]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl md:hidden"
        aria-label="Mobile learning navigation"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                active ? "bg-amber-300/10 text-amber-200" : "text-white/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
