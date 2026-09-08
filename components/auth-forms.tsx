"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

type AuthMode = "signin" | "signup";

function TextInput({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
  icon: Icon,
  minLength,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder: string;
  icon: typeof Mail;
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && visible ? "text" : type;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/70">{label}</span>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition group-focus-within:text-amber-400" />
        <input
          name={name}
          type={resolvedType}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
          className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] pl-10 pr-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-amber-400/50 focus:bg-white/[0.065] focus:ring-4 focus:ring-amber-400/5"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 transition hover:text-white/70"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </label>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
    >
      {message}
    </div>
  );
}

export function AuthForm({
  mode,
  nextPath = "/tutor",
  notice,
}: {
  mode: AuthMode;
  nextPath?: string;
  notice?: string;
}) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch(`/api/auth/${isSignup ? "signup" : "signin"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (data.needsEmailConfirmation) {
        setConfirmationSent(true);
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (confirmationSent) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl shadow-black/30 sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">
          Check your inbox
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/50">
          We sent you a confirmation link. Confirm your email and you&apos;ll be
          ready to start speaking.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-black transition hover:bg-amber-300"
        >
          Go to sign in
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-medium text-amber-400">
          {isSignup ? "Create your account" : "Welcome back"}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
          {isSignup ? "Start speaking with confidence" : "Continue your practice"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/45">
          {isSignup
            ? "A few seconds now. More confident conversations later."
            : "Your AI language tutor is ready when you are."}
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
        >
          {notice}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        {isSignup && (
          <TextInput
            label="Full name"
            name="name"
            placeholder="Your name"
            autoComplete="name"
            icon={UserRound}
            minLength={2}
          />
        )}
        <TextInput
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          icon={Mail}
        />
        <div>
          <TextInput
            label="Password"
            name="password"
            type="password"
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            icon={LockKeyhole}
            minLength={isSignup ? 8 : 6}
          />
          {!isSignup && (
            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-white/45 transition hover:text-amber-300"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </div>

        {error && <ErrorMessage message={error} />}

        <button
          type="submit"
          disabled={pending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-semibold text-black shadow-[0_10px_40px_-12px_rgba(251,191,36,0.7)] transition hover:-translate-y-0.5 hover:bg-amber-300 disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {isSignup ? "Creating account..." : "Signing in..."}
            </>
          ) : (
            <>
              {isSignup ? "Create free account" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-white/40">
        {isSignup ? "Already have an account?" : "New to Talk Tutor?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-white transition hover:text-amber-300"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>

      {isSignup && (
        <p className="mt-5 text-center text-[11px] leading-5 text-white/25">
          By creating an account, you agree to use Talk Tutor responsibly.
        </p>
      )}
    </div>
  );
}

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to send reset email.");
        return;
      }

      setMessage(data.message);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-amber-400">Password recovery</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
        Reset your password
      </h2>
      <p className="mt-3 text-sm leading-6 text-white/45">
        Enter your account email and we&apos;ll send you a secure reset link.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <TextInput
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          icon={Mail}
        />
        {error && <ErrorMessage message={error} />}
        {message && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-200">
            {message}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60"
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Send reset link
        </button>
      </form>

      <Link
        href="/login"
        className="mt-7 block text-center text-sm text-white/45 transition hover:text-white"
      >
        Back to sign in
      </Link>
    </div>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    setAccessToken(params.get("access_token") ?? "");
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setPending(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to update password.");
        return;
      }

      router.replace("/login?reset=success");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-amber-400">Choose a new password</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
        Secure your account
      </h2>
      <p className="mt-3 text-sm leading-6 text-white/45">
        Use at least 8 characters for your new password.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <TextInput
          label="New password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          icon={LockKeyhole}
          minLength={8}
        />
        <TextInput
          label="Confirm password"
          name="confirmPassword"
          type="password"
          placeholder="Repeat your password"
          autoComplete="new-password"
          icon={LockKeyhole}
          minLength={8}
        />
        {!accessToken && (
          <ErrorMessage message="This reset link is missing a valid session. Request a new link." />
        )}
        {error && <ErrorMessage message={error} />}
        <button
          type="submit"
          disabled={pending || !accessToken}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Update password
        </button>
      </form>
    </div>
  );
}

export function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function saveSession() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const expiresIn = Number(params.get("expires_in") ?? "3600");

      if (!accessToken) {
        setError(params.get("error_description") ?? "The confirmation link is invalid or expired.");
        return;
      }

      try {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: Number.isFinite(expiresIn) ? expiresIn : 3600,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Unable to finish signing in.");
          return;
        }

        router.replace("/tutor");
        router.refresh();
      } catch {
        setError("Could not finish signing in. Please try again.");
      }
    }

    void saveSession();
  }, [router]);

  return (
    <div className="text-center">
      {error ? (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-400/10 text-red-300">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold">Couldn&apos;t confirm your account</h2>
          <p className="mt-3 text-sm leading-6 text-white/45">{error}</p>
          <Link
            href="/login"
            className="mt-7 inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-black"
          >
            Return to sign in
          </Link>
        </>
      ) : (
        <>
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-amber-400" />
          <h2 className="mt-6 text-2xl font-semibold">Finishing your sign in</h2>
          <p className="mt-3 text-sm text-white/45">Your speaking space is almost ready.</p>
        </>
      )}
    </div>
  );
}
