"use client";

import {
  GraduationCap,
  Globe,
  MessageSquare,
  Mic,
  Palette,
  Settings2,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import {
  AVAILABLE_LANGUAGES,
  AVAILABLE_PROFICIENCY_LEVELS,
  AVAILABLE_TOPICS,
  AVAILABLE_VOICES,
} from "@/lib/constants";
import {
  PRACTICE_SCENARIOS,
  type ConversationDifficulty,
  type CorrectionFrequency,
  type PracticeMode,
} from "@/lib/learning/practice";
import {
  GRAMMAR_CATEGORIES,
  type GrammarCategory,
} from "@/lib/learning/types";
import { useAudioStore } from "@/store/useAudioStore";
import { ConnectionState } from "@/types";
import SidebarHeader from "./sidebar-header";

const fieldClass =
  "mt-2 min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const mistakeLabels: Record<GrammarCategory, string> = {
  articles: "Articles",
  verb_tense: "Verb tense",
  prepositions: "Prepositions",
  word_order: "Word order",
  pluralization: "Pluralization",
  vocabulary_misuse: "Vocabulary misuse",
  agreement: "Subject-verb agreement",
  other: "Other",
};

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5 opacity-70" />
      {children}
    </div>
  );
}

export default function LeftSidebar() {
  const state = useAudioStore();
  const disabled = state.connectionState !== ConnectionState.DISCONNECTED;

  function toggleMistake(category: GrammarCategory) {
    const selected = state.targetMistakeCategories;
    if (selected.includes(category)) {
      state.setTargetMistakeCategories(
        selected.filter((value) => value !== category),
      );
      return;
    }
    if (selected.length < 3) {
      state.setTargetMistakeCategories([...selected, category]);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <SidebarHeader icon={Settings2} title="Practice setup" />
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        <div>
          <SectionLabel icon={Globe}>Language</SectionLabel>
          <select
            className={fieldClass}
            value={state.selectedLanguage}
            onChange={(event) => state.setSelectedLanguage(event.target.value)}
            disabled={disabled}
          >
            {AVAILABLE_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name} · {language.region}
              </option>
            ))}
          </select>
        </div>

        <div>
          <SectionLabel icon={GraduationCap}>Skill level</SectionLabel>
          <select
            className={fieldClass}
            value={state.selectedProficiencyLevel}
            onChange={(event) =>
              state.setSelectedProficiencyLevel(event.target.value)
            }
            disabled={disabled}
          >
            {AVAILABLE_PROFICIENCY_LEVELS.map((level) => (
              <option key={level.id} value={level.label}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <SectionLabel icon={Sparkles}>Practice mode</SectionLabel>
          <select
            className={fieldClass}
            value={state.practiceMode}
            onChange={(event) =>
              state.setPracticeMode(event.target.value as PracticeMode)
            }
            disabled={disabled}
          >
            <option value="conversation">Conversation</option>
            <option value="roleplay">Roleplay</option>
            <option value="mistakes">Practice my mistakes</option>
            <option value="custom">Custom practice</option>
          </select>
        </div>

        <div>
          <SectionLabel icon={MessageSquare}>Topic</SectionLabel>
          <input
            className={fieldClass}
            list="talk-tutor-topic-suggestions"
            value={state.selectedTopic}
            onChange={(event) => state.setSelectedTopic(event.target.value)}
            maxLength={120}
            disabled={disabled}
            placeholder="Type any topic"
          />
          <datalist id="talk-tutor-topic-suggestions">
            {AVAILABLE_TOPICS.map((topic) => (
              <option key={topic} value={topic} />
            ))}
          </datalist>
        </div>

        {state.practiceMode === "roleplay" && (
          <div>
            <SectionLabel icon={UsersRound}>Roleplay</SectionLabel>
            <select
              className={fieldClass}
              value={state.scenarioId}
              onChange={(event) => state.applyScenario(event.target.value)}
              disabled={disabled}
            >
              <option value="">Custom roleplay</option>
              {PRACTICE_SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.title}
                </option>
              ))}
            </select>
            <textarea
              className={fieldClass + " min-h-24 py-2"}
              value={state.customScenario}
              onChange={(event) => state.setCustomScenario(event.target.value)}
              maxLength={600}
              disabled={disabled}
              placeholder="Describe the situation"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                className={fieldClass}
                value={state.learnerRole}
                onChange={(event) => state.setLearnerRole(event.target.value)}
                maxLength={80}
                disabled={disabled}
                placeholder="Your role"
              />
              <input
                className={fieldClass}
                value={state.tutorRole}
                onChange={(event) => state.setTutorRole(event.target.value)}
                maxLength={80}
                disabled={disabled}
                placeholder="Tutor role"
              />
            </div>
          </div>
        )}

        {state.practiceMode === "custom" && (
          <div>
            <SectionLabel icon={UsersRound}>Custom situation</SectionLabel>
            <textarea
              className={fieldClass + " min-h-24 py-2"}
              value={state.customScenario}
              onChange={(event) => state.setCustomScenario(event.target.value)}
              maxLength={600}
              disabled={disabled}
              placeholder="Describe what you want to practice"
            />
          </div>
        )}

        {state.practiceMode === "mistakes" && (
          <div>
            <SectionLabel icon={Target}>Target weaknesses</SectionLabel>
            <p className="mb-2 text-[11px] leading-4 text-muted-foreground">
              Choose up to three. Recent recurring mistakes are preselected.
            </p>
            <div className="flex flex-wrap gap-2">
              {GRAMMAR_CATEGORIES.map((category) => {
                const active = state.targetMistakeCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleMistake(category)}
                    disabled={
                      disabled ||
                      (!active && state.targetMistakeCategories.length >= 3)
                    }
                    aria-pressed={active}
                    className={
                      active
                        ? "rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        : "rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                    }
                  >
                    {mistakeLabels[category]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            Corrections
            <select
              className={fieldClass}
              value={state.correctionFrequency}
              onChange={(event) =>
                state.setCorrectionFrequency(
                  event.target.value as CorrectionFrequency,
                )
              }
              disabled={disabled}
            >
              <option value="minimal">Minimal</option>
              <option value="balanced">Balanced</option>
              <option value="frequent">Frequent</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Difficulty
            <select
              className={fieldClass}
              value={state.difficulty}
              onChange={(event) =>
                state.setDifficulty(
                  event.target.value as ConversationDifficulty,
                )
              }
              disabled={disabled}
            >
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="challenging">Challenging</option>
            </select>
          </label>
        </div>

        <div>
          <SectionLabel icon={Mic}>AI voice</SectionLabel>
          <select
            className={fieldClass}
            value={state.selectedAssistantVoice}
            onChange={(event) =>
              state.setselectedAssistantVoice(event.target.value)
            }
            disabled={disabled}
          >
            {AVAILABLE_VOICES.map((voice) => (
              <option key={voice.id} value={voice.name}>
                {voice.name} · {voice.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-none border-t bg-background p-4">
        {(state.preferencesSaving || state.preferenceError) && (
          <div
            className={
              state.preferenceError
                ? "mb-3 text-[11px] text-destructive"
                : "mb-3 text-[11px] text-muted-foreground"
            }
            aria-live="polite"
          >
            {state.preferenceError ?? "Saving tutor preference…"}
          </div>
        )}
        {disabled && (
          <p className="mb-3 text-[11px] text-muted-foreground">
            End the current session to change practice configuration.
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Palette className="h-3.5 w-3.5" />
            <span>Appearance</span>
          </div>
          <ModeToggle />
        </div>
      </div>
    </aside>
  );
}
