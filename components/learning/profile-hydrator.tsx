"use client";

import { useEffect } from "react";
import { useAudioStore } from "@/store/useAudioStore";
import type {
  ConversationDifficulty,
  CorrectionFrequency,
  PracticeMode,
} from "@/lib/learning/practice";
import type { GrammarCategory } from "@/lib/learning/types";

export function ProfileHydrator({
  preferredLanguage,
  proficiencyLevel,
  preferredVoice,
  correctionFrequency,
  conversationDifficulty,
  practiceMode,
  scenarioId,
  targetMistakeCategories,
}: {
  preferredLanguage: string;
  proficiencyLevel: string;
  preferredVoice: string;
  correctionFrequency: CorrectionFrequency;
  conversationDifficulty: ConversationDifficulty;
  practiceMode?: PracticeMode;
  scenarioId?: string;
  targetMistakeCategories?: GrammarCategory[];
}) {
  const hydratePreferences = useAudioStore((state) => state.hydratePreferences);

  useEffect(() => {
    hydratePreferences({
      preferredLanguage,
      proficiencyLevel,
      preferredVoice,
      correctionFrequency,
      conversationDifficulty,
      practiceMode,
      scenarioId,
      targetMistakeCategories,
    });
  }, [
    correctionFrequency,
    conversationDifficulty,
    hydratePreferences,
    practiceMode,
    preferredLanguage,
    preferredVoice,
    proficiencyLevel,
    scenarioId,
    targetMistakeCategories,
  ]);

  return null;
}
