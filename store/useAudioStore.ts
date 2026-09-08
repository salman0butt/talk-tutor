import {
    AVAILABLE_LANGUAGES,
    AVAILABLE_PROFICIENCY_LEVELS,
    AVAILABLE_VOICES,
    DEFAULT_CONFIGURATION,
} from "@/lib/constants";
import { LiveManager } from "@/services/liveManager";
import { AgentState, AudioVolume, ConnectionState, TranscriptItem } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type TutorPreferencePatch = {
    preferredLanguage?: string;
    proficiencyLevel?: string;
    preferredVoice?: string;
};

export type AudioStore = {
    connectionState: ConnectionState;
    error: string | null;
    preferenceError: string | null;
    preferencesSaving: boolean;
    isMuted: boolean;
    audioLevel: AudioVolume;
    agentState: AgentState;
    liveManagerInstance: LiveManager | null;
    transcript: TranscriptItem[];
    selectedLanguage: string;
    selectedTopic: string;
    selectedAssistantVoice: string;
    selectedProficiencyLevel: string;
    hydratePreferences: (preferences: {
        preferredLanguage: string;
        proficiencyLevel: string;
        preferredVoice: string;
    }) => void;
    setSelectedLanguage: (language: string) => void;
    setSelectedTopic: (topic: string) => void;
    setselectedAssistantVoice: (voice: string) => void;
    setSelectedProficiencyLevel: (level: string) => void;
    connect: () => void;
    disconnect: () => void;
    toggleMute: () => void;
};

export const useAudioStore = create<AudioStore>()(
    devtools(
        (set, get) => {
            const persistPreference = async (patch: TutorPreferencePatch) => {
                set({ preferencesSaving: true, preferenceError: null });
                try {
                    const response = await fetch("/api/learning/profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(patch),
                    });
                    if (!response.ok) {
                        const payload = await response.json().catch(() => null);
                        throw new Error(payload?.error ?? "Could not save tutor preference.");
                    }
                } catch (reason) {
                    set({
                        preferenceError:
                            reason instanceof Error
                                ? reason.message
                                : "Could not save tutor preference.",
                    });
                } finally {
                    set({ preferencesSaving: false });
                }
            };

            return {
                connectionState: ConnectionState.DISCONNECTED,
                error: null,
                preferenceError: null,
                preferencesSaving: false,
                isMuted: false,
                audioLevel: { input: 0, output: 0 },
                agentState: null,
                liveManagerInstance: null,
                transcript: [],
                ...DEFAULT_CONFIGURATION,
                hydratePreferences: (preferences) =>
                    set({
                        selectedLanguage: preferences.preferredLanguage,
                        selectedProficiencyLevel: preferences.proficiencyLevel,
                        selectedAssistantVoice: preferences.preferredVoice,
                        preferenceError: null,
                    }),
                setSelectedLanguage: (language) => {
                    set({ selectedLanguage: language });
                    void persistPreference({ preferredLanguage: language });
                },
                setSelectedTopic: (topic) => set({ selectedTopic: topic }),
                setselectedAssistantVoice: (voice) => {
                    set({ selectedAssistantVoice: voice });
                    void persistPreference({ preferredVoice: voice });
                },
                setSelectedProficiencyLevel: (level) => {
                    set({ selectedProficiencyLevel: level });
                    void persistPreference({ proficiencyLevel: level });
                },
                connect: async () => {
                    const state = get();

                    const response = await fetch("/api/token");
                    if (!response.ok) {
                        set({ error: "Failed to fetch token" });
                        return;
                    }

                    const data = await response.json();
                    const token = data.token;

                    if (!token) {
                        set({ error: "Token is missing in the response" });
                        return;
                    }

                    if (
                        state.connectionState === ConnectionState.CONNECTING ||
                        state.connectionState === ConnectionState.CONNECTED
                    ) {
                        return;
                    }

                    set({ error: null });

                    try {
                        const permissionStream = await navigator.mediaDevices.getUserMedia({
                            audio: true,
                            video: false,
                        });
                        permissionStream.getTracks().forEach((track) => track.stop());
                    } catch {
                        set({ error: "Microphone permission denied" });
                        return;
                    }

                    let manager = state.liveManagerInstance;

                    if (!manager) {
                        manager = new LiveManager(
                            {
                                onStateChange: (newState: ConnectionState) =>
                                    set({
                                        connectionState: newState,
                                        agentState:
                                            newState === ConnectionState.CONNECTED
                                                ? "listening"
                                                : newState === ConnectionState.CONNECTING
                                                  ? "thinking"
                                                  : null,
                                    }),
                                onTranscript: (sender, text, partial) => {
                                    const newTranscript = [...get().transcript];
                                    const existingIndex = newTranscript.findIndex(
                                        (item) => item.sender === sender && item.isPartial,
                                    );

                                    if (existingIndex !== -1) {
                                        newTranscript[existingIndex] = {
                                            ...newTranscript[existingIndex],
                                            text,
                                            isPartial: partial,
                                        };
                                        set({ transcript: newTranscript });
                                        return;
                                    }

                                    if (text.trim() === "") return;

                                    newTranscript.push({
                                        id: `${sender}-${Date.now()}`,
                                        sender,
                                        text,
                                        isPartial: partial,
                                    });
                                    set({ transcript: newTranscript });
                                },
                                onAudioLevel: (level, type) =>
                                    set((current) => ({
                                        audioLevel: { ...current.audioLevel, [type]: level },
                                    })),
                                onAgentState: (agentState) => set({ agentState }),
                                onError: (error: string) => set({ error }),
                            },
                            token.name,
                        );
                        set({ liveManagerInstance: manager });
                    }

                    const language =
                        AVAILABLE_LANGUAGES.find(
                            ({ code }) => code === state.selectedLanguage,
                        ) ?? AVAILABLE_LANGUAGES[0];
                    const proficiency =
                        AVAILABLE_PROFICIENCY_LEVELS.find(
                            ({ id, label }) =>
                                id === state.selectedProficiencyLevel ||
                                label === state.selectedProficiencyLevel,
                        ) ?? AVAILABLE_PROFICIENCY_LEVELS[0];
                    const voice =
                        AVAILABLE_VOICES.find(
                            ({ id, name }) =>
                                id === state.selectedAssistantVoice ||
                                name === state.selectedAssistantVoice,
                        )?.name ?? state.selectedAssistantVoice;

                    manager.startSession({
                        selected_topic: state.selectedTopic,
                        description: proficiency.description,
                        selected_launguage_name: language.name || "English",
                        selected_launguage_code: language.code || "en-US",
                        selected_launguage_region: language.region || "United States",
                        context: "",
                        selected_proefficent_level: proficiency.label,
                        selected_assistant_voice: voice,
                    });
                },
                disconnect: async () => {
                    const manager = get().liveManagerInstance;
                    if (!manager) return;

                    await manager.disconnect();
                    set({
                        connectionState: ConnectionState.DISCONNECTED,
                        isMuted: false,
                        audioLevel: { input: 0, output: 0 },
                        agentState: null,
                    });
                },
                toggleMute: () => {
                    const state = get();
                    const newMuteState = !state.isMuted;
                    set({ isMuted: newMuteState });
                    state.liveManagerInstance?.setMute(newMuteState);
                },
            };
        },
        { name: "Talk Tutor Audio Store" },
    ),
);
