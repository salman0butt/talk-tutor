"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import LeftSidebar from "@/components/left-sidebar";
import RightSidebar from "@/components/right-sidebar";

import {
  BookOpenText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  LucideLanguages,
  Menu,
  Settings2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Navbar({ userEmail }: { userEmail?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);

    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <header className="relative z-50 w-full border-b bg-background/90 backdrop-blur">
      <div className="relative flex h-16 items-center px-4 md:px-6">
        <div className="flex items-center gap-1">
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open learning navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>Talk Tutor</SheetTitle>
                  <SheetDescription>Navigate your learning workspace</SheetDescription>
                </SheetHeader>
                <nav className="mt-6 grid gap-2" aria-label="Learning navigation">
                  <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link href="/history" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <BookOpenText className="h-4 w-4" />
                    History
                  </Link>
                  <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <UserRound className="h-4 w-4" />
                    Profile
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Learning navigation">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/history">
                <BookOpenText className="h-4 w-4" />
                History
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/profile">
                <UserRound className="h-4 w-4" />
                Profile
              </Link>
            </Button>
          </nav>

          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Settings2 className="h-5 w-5" />
                  <span className="sr-only">Open configuration</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader className="sr-only">
                  <SheetTitle>Configuration</SheetTitle>
                  <SheetDescription>Set your app configuration</SheetDescription>
                </SheetHeader>
                <LeftSidebar />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-3"
        >
          <div className="relative h-11 w-11 overflow-hidden rounded-md">
            <Image
              src="/logo-tutor.png"
              alt="Talk Tutor"
              fill
              sizes="44px"
              className="object-contain"
              priority
            />
          </div>

          <span className="hidden text-lg font-semibold tracking-tight sm:inline md:text-xl">
            Talk <span className="text-primary">Tutor</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <LucideLanguages className="h-5 w-5" />
                  <span className="sr-only">Open transcript</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader className="sr-only">
                  <SheetTitle>Transcript</SheetTitle>
                  <SheetDescription>Voice conversation transcript</SheetDescription>
                </SheetHeader>
                <RightSidebar />
              </SheetContent>
            </Sheet>
          </div>

          {userEmail && (
            <span className="hidden max-w-44 truncate text-xs text-muted-foreground xl:inline">
              {userEmail}
            </span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={signOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="sr-only">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
