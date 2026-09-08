"use client";

import { useEffect } from "react";
import { useAudioStore } from "@/store/useAudioStore";

export function ProfileHydrator({
  preferredLanguage,
  proficiencyLevel,
  preferredVoice,
}: {
  preferredLanguage: string;
  proficiencyLevel: string;
  preferredVoice: string;
}) {
  const hydratePreferences = useAudioStore((state) => state.hydratePreferences);

  useEffect(() => {
    hydratePreferences({ preferredLanguage, proficiencyLevel, preferredVoice });
  }, [hydratePreferences, preferredLanguage, proficiencyLevel, preferredVoice]);

  return null;
}
