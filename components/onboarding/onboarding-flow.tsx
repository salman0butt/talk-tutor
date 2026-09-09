"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import {
  PLACEMENT_QUESTIONS,
  scorePlacementAnswers,
  type ProficiencyLevel,
} from "@/lib/onboarding/placement";
import {
  getOnboardingRecommendation,
  ONBOARDING_GOALS,
  type OnboardingGoal,
} from "@/lib/onboarding/recommendations";

const LEVELS: ProficiencyLevel[] = [
  "Basic",
  "Intermediate",
  "Top Class",
];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<OnboardingGoal | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedLevel, setSelectedLevel] =
    useState<ProficiencyLevel>("Basic");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const allAnswered = PLACEMENT_QUESTIONS.every(
    (question) => Boolean(answers[question.id]),
  );

  const placement = useMemo(() => {
    if (!allAnswered) return null;
    try {
      return scorePlacementAnswers(answers);
    } catch {
      return null;
    }
  }, [allAnswered, answers]);

  const recommendation =
    goal && placement
      ? getOnboardingRecommendation(goal, selectedLevel)
      : null;

  function advanceFromPlacement() {
    if (!placement) {
      setError("Answer each placement question before continuing.");
      return;
    }
    setSelectedLevel(placement.recommendedLevel);
    setError("");
    setStep(3);
  }

  async function complete() {
    if (!goal || !placement) return;
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          answers,
          selectedLevel,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not complete onboarding.");
      }
      if (typeof payload?.tutorHref !== "string") {
        throw new Error("Onboarding response was incomplete.");
      }
      router.push(payload.tutorHref);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not complete onboarding.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] shadow-2xl shadow-black/20">
      <div className="border-b border-white/[0.07] px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between text-xs text-white/35">
          <span>Step {step} of 3</span>
          <span>
            {step === 1
              ? "Your goal"
              : step === 2
                ? "Quick placement"
                : "Your starting plan"}
          </span>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
          aria-label={`Onboarding progress: step ${step} of 3`}
        >
          <div
            className="h-full rounded-full bg-amber-400 transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {step === 1 && (
          <div>
            <p className="text-sm font-medium text-amber-300">
              What do you want English for first?
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Choose one practical goal.
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {ONBOARDING_GOALS.map((item) => {
                const active = goal === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setGoal(item.value)}
                    aria-pressed={active}
                    className={
                      active
                        ? "rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-left ring-2 ring-amber-300/20"
                        : "rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{item.label}</span>
                      {active && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-black">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/40">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm font-medium text-amber-300">
              Quick placement
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Six short language questions.
            </h2>
            <p className="mt-2 text-sm text-white/40">
              This estimates a starting level. It is not a certification.
            </p>
            <div className="mt-6 space-y-6">
              {PLACEMENT_QUESTIONS.map((question, index) => (
                <fieldset key={question.id}>
                  <legend className="text-sm font-medium text-white/80">
                    {index + 1}. {question.prompt}
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {question.options.map((option) => {
                      const active = answers[question.id] === option.id;
                      return (
                        <label
                          key={option.id}
                          className={
                            active
                              ? "flex cursor-pointer items-center gap-3 rounded-xl border border-amber-300/35 bg-amber-300/[0.08] px-4 py-3 text-sm"
                              : "flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] px-4 py-3 text-sm text-white/60 hover:bg-white/[0.03]"
                          }
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option.id}
                            checked={active}
                            onChange={() =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: option.id,
                              }))
                            }
                            className="accent-amber-400"
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        )}

        {step === 3 && placement && goal && recommendation && (
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="mt-5 text-sm font-medium text-amber-300">
              Recommended starting level
            </p>
            <h2 className="mt-2 text-3xl font-semibold">
              {placement.recommendedLevel}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/40">
              You answered {placement.score} of {PLACEMENT_QUESTIONS.length}{" "}
              correctly. Use the recommendation or choose another level before
              starting.
            </p>

            <label className="mt-6 block text-sm text-white/65">
              Starting level
              <select
                value={selectedLevel}
                onChange={(event) =>
                  setSelectedLevel(event.target.value as ProficiencyLevel)
                }
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#15161c] px-3 text-sm text-white outline-none focus:border-amber-300/50"
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/30">
                First practice
              </p>
              <p className="mt-2 font-semibold">{recommendation.topic}</p>
              <p className="mt-2 text-sm text-white/40">
                {recommendation.practiceMode === "roleplay"
                  ? "A guided roleplay"
                  : "A focused conversation"}{" "}
                at {recommendation.difficulty} difficulty.
              </p>
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
          <button
            type="button"
            onClick={() => {
              setError("");
              setStep((current) =>
                current === 3 ? 2 : current === 2 ? 1 : 1,
              );
            }}
            disabled={step === 1 || pending}
            className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm text-white/45 transition hover:bg-white/[0.04] hover:text-white disabled:invisible"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step === 1 && (
            <button
              type="button"
              disabled={!goal}
              onClick={() => {
                setError("");
                setStep(2);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-40"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              disabled={!allAnswered}
              onClick={advanceFromPlacement}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-40"
            >
              See my level
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void complete()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
            >
              {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {pending ? "Saving..." : "Start first practice"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
