import {
    AVAILABLE_LANGUAGES,
    AVAILABLE_PROFICIENCY_LEVELS,
    AVAILABLE_VOICES,
    DEFAULT_CONFIGURATION,
} from "@/lib/constants";
import {
    parsePracticeConfiguration,
    PRACTICE_SCENARIOS,
    type ConversationDifficulty,
    type CorrectionFrequency,
    type PracticeMode,
} from "@/lib/learning/practice";
import type { GrammarCategory } from "@/lib/learning/types";
import { browserLearningSessionApi } from "@/lib/learning/session-api";
import { LearningSessionRecorder } from "@/lib/learning/session-recorder";
import { LiveManager } from "@/services/liveManager";
import { AgentState, AudioVolume, ConnectionState, TranscriptItem } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type TutorPreferencePatch = {
    preferredLanguage?: string;
    proficiencyLevel?: string;
    preferredVoice?: string;
    correctionFrequency?: CorrectionFrequency;
    conversationDifficulty?: ConversationDifficulty;
};

export type AudioStore = {
    connectionState: ConnectionState;
    error: string | null;
    preferenceError: string | null;
    preferencesSaving: boolean;
    sessionPersistenceError: string | null;
    isMuted: boolean;
    audioLevel: AudioVolume;
    agentState: AgentState;
    liveManagerInstance: LiveManager | null;
    sessionRecorder: LearningSessionRecorder | null;
    transcript: TranscriptItem[];
    selectedLanguage: string;
    selectedTopic: string;
    selectedAssistantVoice: string;
    selectedProficiencyLevel: string;
    practiceMode: PracticeMode;
    correctionFrequency: CorrectionFrequency;
    difficulty: ConversationDifficulty;
    scenarioId: string;
    customScenario: string;
    learnerRole: string;
    tutorRole: string;
    targetMistakeCategories: GrammarCategory[];
    hydratePreferences: (preferences: {
        preferredLanguage: string;
        proficiencyLevel: string;
        preferredVoice: string;
        correctionFrequency: CorrectionFrequency;
        conversationDifficulty: ConversationDifficulty;
        practiceMode?: PracticeMode;
        scenarioId?: string;
        targetMistakeCategories?: GrammarCategory[];
    }) => void;
    setSelectedLanguage: (language: string) => void;
    setSelectedTopic: (topic: string) => void;
    setselectedAssistantVoice: (voice: string) => void;
    setSelectedProficiencyLevel: (level: string) => void;
    setPracticeMode: (mode: PracticeMode) => void;
    setCorrectionFrequency: (frequency: CorrectionFrequency) => void;
    setDifficulty: (difficulty: ConversationDifficulty) => void;
    applyScenario: (scenarioId: string) => void;
    setCustomScenario: (scenario: string) => void;
    setLearnerRole: (role: string) => void;
    setTutorRole: (role: string) => void;
    setTargetMistakeCategories: (categories: GrammarCategory[]) => void;
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

            const reportSessionPersistenceError = (reason: unknown) => {
                set({
                    sessionPersistenceError:
                        reason instanceof Error
                            ? reason.message
                            : "Practice history could not be saved.",
                });
            };

            return {
                connectionState: ConnectionState.DISCONNECTED,
                error: null,
                preferenceError: null,
                preferencesSaving: false,
                sessionPersistenceError: null,
                isMuted: false,
                audioLevel: { input: 0, output: 0 },
                agentState: null,
                liveManagerInstance: null,
                sessionRecorder: null,
                transcript: [],
                ...DEFAULT_CONFIGURATION,
                practiceMode: "conversation",
                correctionFrequency: "balanced",
                difficulty: "normal",
                scenarioId: "",
                customScenario: "",
                learnerRole: "",
                tutorRole: "",
                targetMistakeCategories: [],
                hydratePreferences: (preferences) =>
                    set((current) => {
                        const scenario = preferences.scenarioId
                            ? PRACTICE_SCENARIOS.find(
                                  (candidate) =>
                                      candidate.id === preferences.scenarioId,
                              )
                            : null;
                        return {
                            selectedLanguage: preferences.preferredLanguage,
                            selectedProficiencyLevel: preferences.proficiencyLevel,
                            selectedAssistantVoice: preferences.preferredVoice,
                            correctionFrequency: preferences.correctionFrequency,
                            difficulty: preferences.conversationDifficulty,
                            practiceMode:
                                preferences.practiceMode ?? current.practiceMode,
                            scenarioId:
                                scenario?.id ??
                                preferences.scenarioId ??
                                current.scenarioId,
                            ...(scenario
                                ? {
                                      selectedTopic: scenario.title,
                                      customScenario: scenario.situation,
                                      learnerRole: scenario.learnerRole,
                                      tutorRole: scenario.tutorRole,
                                  }
                                : {}),
                            targetMistakeCategories:
                                preferences.targetMistakeCategories ??
                                current.targetMistakeCategories,
                            preferenceError: null,
                        };
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
                setPracticeMode: (practiceMode) => set({ practiceMode }),
                setCorrectionFrequency: (correctionFrequency) =>
                    set({ correctionFrequency }),
                setDifficulty: (difficulty) => set({ difficulty }),
                applyScenario: (scenarioId) => {
                    const scenario = PRACTICE_SCENARIOS.find(
                        (candidate) => candidate.id === scenarioId,
                    );
                    if (!scenario) {
                        set({ scenarioId: "" });
                        return;
                    }
                    set({
                        practiceMode: "roleplay",
                        scenarioId,
                        selectedTopic: scenario.title,
                        customScenario: scenario.situation,
                        learnerRole: scenario.learnerRole,
                        tutorRole: scenario.tutorRole,
                    });
                },
                setCustomScenario: (customScenario) => set({ customScenario }),
                setLearnerRole: (learnerRole) => set({ learnerRole }),
                setTutorRole: (tutorRole) => set({ tutorRole }),
                setTargetMistakeCategories: (targetMistakeCategories) =>
                    set({ targetMistakeCategories }),
                connect: async () => {
                    const state = get();
                    if (
                        state.connectionState === ConnectionState.CONNECTING ||
                        state.connectionState === ConnectionState.CONNECTED
                    ) {
                        return;
                    }

                    set({
                        error: null,
                        sessionPersistenceError: null,
                        transcript: [],
                    });

                    let practiceConfig;
                    try {
                        practiceConfig = parsePracticeConfiguration({
                            practiceMode: state.practiceMode,
                            topic: state.selectedTopic,
                            scenarioId: state.scenarioId || undefined,
                            customScenario: state.customScenario || undefined,
                            learnerRole: state.learnerRole || undefined,
                            tutorRole: state.tutorRole || undefined,
                            correctionFrequency: state.correctionFrequency,
                            difficulty: state.difficulty,
                            targetMistakeCategories:
                                state.practiceMode === "mistakes"
                                    ? state.targetMistakeCategories
                                    : [],
                        });
                    } catch (reason) {
                        set({
                            error:
                                reason instanceof Error
                                    ? reason.message
                                    : "Invalid practice configuration.",
                        });
                        return;
                    }

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

                    const recorder = new LearningSessionRecorder(browserLearningSessionApi);
                    recorder.begin({
                        language: language.code,
                        proficiencyLevel: proficiency.label,
                        assistantVoice: voice,
                        ...practiceConfig,
                    });
                    set({ sessionRecorder: recorder });

                    const manager = new LiveManager(
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
                                } else if (text.trim() !== "") {
                                    newTranscript.push({
                                        id: `${sender}-${Date.now()}`,
                                        sender,
                                        text,
                                        isPartial: partial,
                                    });
                                }
                                set({ transcript: newTranscript });

                                if (!partial && text.trim()) {
                                    const role =
                                        sender === "model" ? "assistant" : "user";
                                    void get()
                                        .sessionRecorder?.recordFinalTurn(
                                            role,
                                            text,
                                            new Date().toISOString(),
                                        )
                                        .catch(reportSessionPersistenceError);
                                }
                            },
                            onAudioLevel: (level, type) =>
                                set((current) => ({
                                    audioLevel: {
                                        ...current.audioLevel,
                                        [type]: level,
                                    },
                                })),
                            onAgentState: (agentState) => set({ agentState }),
                            onError: (error: string) => set({ error }),
                            onSessionClosed: () => {
                                const activeRecorder = get().sessionRecorder;
                                if (activeRecorder) {
                                    void activeRecorder
                                        .finalize()
                                        .catch(reportSessionPersistenceError);
                                }
                            },
                        },
                        token.name,
                    );
                    set({ liveManagerInstance: manager });

                    await manager.startSession({
                        selected_topic: practiceConfig.topic,
                        description: proficiency.description,
                        selected_launguage_name: language.name || "English",
                        selected_launguage_code: language.code || "en-US",
                        selected_launguage_region: language.region || "United States",
                        context: "",
                        selected_proefficent_level: proficiency.label,
                        selected_assistant_voice: voice,
                        practice_config: practiceConfig,
                    });
                },
                disconnect: async () => {
                    const { liveManagerInstance: manager, sessionRecorder: recorder } = get();
                    const results = await Promise.allSettled([
                        manager?.disconnect(),
                        recorder?.finalize(),
                    ]);
                    const persistenceResult = results[1];
                    if (persistenceResult?.status === "rejected") {
                        reportSessionPersistenceError(persistenceResult.reason);
                    }

                    set({
                        connectionState: ConnectionState.DISCONNECTED,
                        isMuted: false,
                        audioLevel: { input: 0, output: 0 },
                        agentState: null,
                        sessionRecorder: null,
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
