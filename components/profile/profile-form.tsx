"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Clock3, Globe2, LoaderCircle, Save, Sparkles } from "lucide-react";
import { AVAILABLE_LANGUAGES, AVAILABLE_PROFICIENCY_LEVELS, AVAILABLE_VOICES } from "@/lib/constants";
import { LEARNING_GOALS, type LearningProfile } from "@/lib/learning/types";

const goalLabels: Record<(typeof LEARNING_GOALS)[number], string> = {
  everyday_conversation: "Everyday conversation",
  travel: "Travel",
  business: "Business",
  interview_preparation: "Interview preparation",
  academic_language: "Academic language",
  general_fluency: "General fluency",
  immigration: "Immigration",
};

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-amber-300/40 focus:ring-4 focus:ring-amber-300/[0.06]";

export function ProfileForm({ initialProfile }: { initialProfile: LearningProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update<K extends keyof LearningProfile>(key: K, value: LearningProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  function detectTimezone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) update("timezone", timezone);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/learning/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredLanguage: profile.preferredLanguage,
          proficiencyLevel: profile.proficiencyLevel,
          preferredVoice: profile.preferredVoice,
          learningGoal: profile.learningGoal,
          dailyPracticeTargetMinutes: profile.dailyPracticeTargetMinutes,
          timezone: profile.timezone,
          correctionFrequency: profile.correctionFrequency,
          conversationDifficulty: profile.conversationDifficulty,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Could not save your profile.");
      setProfile(payload.profile);
      setMessage("Learning preferences saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Tutor defaults</h2>
              <p className="mt-1 text-xs text-white/35">Restored automatically when you return to Practice.</p>
            </div>
          </div>

          <div className="mt-7 space-y-5">
            <label className="block text-sm text-white/65">
              Preferred language
              <select
                className={fieldClass}
                value={profile.preferredLanguage}
                onChange={(event) => update("preferredLanguage", event.target.value)}
              >
                {AVAILABLE_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code} className="bg-[#15161c]">
                    {language.name} · {language.region}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-white/65">
              Proficiency level
              <select
                className={fieldClass}
                value={profile.proficiencyLevel}
                onChange={(event) => update("proficiencyLevel", event.target.value)}
              >
                {AVAILABLE_PROFICIENCY_LEVELS.map((level) => (
                  <option key={level.id} value={level.label} className="bg-[#15161c]">
                    {level.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-white/65">
              Correction frequency
              <select
                className={fieldClass}
                value={profile.correctionFrequency}
                onChange={(event) =>
                  update(
                    "correctionFrequency",
                    event.target.value as LearningProfile["correctionFrequency"],
                  )
                }
              >
                <option value="minimal" className="bg-[#15161c]">Minimal</option>
                <option value="balanced" className="bg-[#15161c]">Balanced</option>
                <option value="frequent" className="bg-[#15161c]">Frequent</option>
              </select>
            </label>

            <label className="block text-sm text-white/65">
              Conversation difficulty
              <select
                className={fieldClass}
                value={profile.conversationDifficulty}
                onChange={(event) =>
                  update(
                    "conversationDifficulty",
                    event.target.value as LearningProfile["conversationDifficulty"],
                  )
                }
              >
                <option value="easy" className="bg-[#15161c]">Easy</option>
                <option value="normal" className="bg-[#15161c]">Normal</option>
                <option value="challenging" className="bg-[#15161c]">Challenging</option>
              </select>
            </label>

            <label className="block text-sm text-white/65">
              Tutor voice
              <select
                className={fieldClass}
                value={profile.preferredVoice}
                onChange={(event) => update("preferredVoice", event.target.value)}
              >
                {AVAILABLE_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.name} className="bg-[#15161c]">
                    {voice.name} · {voice.category}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Learning plan</h2>
              <p className="mt-1 text-xs text-white/35">Keep the first version simple and focused.</p>
            </div>
          </div>

          <div className="mt-7 space-y-5">
            <label className="block text-sm text-white/65">
              Primary goal
              <select
                className={fieldClass}
                value={profile.learningGoal}
                onChange={(event) => update("learningGoal", event.target.value as LearningProfile["learningGoal"])}
              >
                {LEARNING_GOALS.map((goal) => (
                  <option key={goal} value={goal} className="bg-[#15161c]">
                    {goalLabels[goal]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-white/65">
              Daily practice target
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                <input
                  className={`${fieldClass} pl-10`}
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={profile.dailyPracticeTargetMinutes}
                  onChange={(event) => update("dailyPracticeTargetMinutes", Number(event.target.value))}
                />
              </div>
              <span className="mt-2 block text-xs text-white/30">5–180 minutes per day</span>
            </label>

            <label className="block text-sm text-white/65">
              Timezone
              <div className="mt-2 flex gap-2">
                <input
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-amber-300/40 focus:ring-4 focus:ring-amber-300/[0.06]"
                  value={profile.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                  placeholder="Europe/Oslo"
                />
                <button
                  type="button"
                  onClick={detectTimezone}
                  className="rounded-xl border border-white/10 px-3 text-xs font-medium text-white/55 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                >
                  Detect
                </button>
              </div>
              <span className="mt-2 block text-xs text-white/30">Used for streak and practice-day boundaries.</span>
            </label>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          {message && <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />{message}</p>}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {!message && !error && <p className="text-xs text-white/30">Changes affect future practice sessions.</p>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
