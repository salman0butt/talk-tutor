import { AVAILABLE_LANGUAGES, AVAILABLE_PROFICIENCY_LEVELS, AVAILABLE_VOICES, DEFAULT_CONFIGURATION } from "@/lib/constants";
import { LiveManager } from "@/services/liveManager";
import { AgentState, AudioVolume, ConnectionState, TranscriptItem } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type AudioStore = {
    connectionState: ConnectionState;
    error: string | null;
    isMuted: boolean;
    audioLevel: AudioVolume;
    agentState: AgentState;
    liveManagerInstance: LiveManager | null;
    transcript: TranscriptItem[];
    selectedLanguage: string;
    selectedTopic: string;
    selectedAssistantVoice: string;
    selectedProficiencyLevel: string;
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
        (set, get) => ({
            connectionState: ConnectionState.DISCONNECTED,
            error: null,
            isMuted: false,
            audioLevel: { input: 0, output: 0 },
            agentState: null,
            liveManagerInstance: null,
            transcript: [],
            ...DEFAULT_CONFIGURATION,
            setSelectedLanguage: (language) => set({ selectedLanguage: language }),
            setSelectedTopic: (topic) => set({ selectedTopic: topic }),
            setselectedAssistantVoice: (voice) => set({ selectedAssistantVoice: voice }),
            setSelectedProficiencyLevel: (level) => set({ selectedProficiencyLevel: level }),
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

                if (state.connectionState === ConnectionState.CONNECTING || state.connectionState === ConnectionState.CONNECTED) {
                    return
                }

                set({ error: null })

                // Check Permission
                try {
                    const permissionStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                    permissionStream.getTracks().forEach((track) => track.stop());
                } catch {
                    set({ error: "Microphone permission denined" });
                    return;
                }

                let manager = state.liveManagerInstance;

                if (!manager) {
                    manager = new LiveManager({
                        onStateChange: (newState: ConnectionState) => set({
                            connectionState: newState,
                            agentState: newState === ConnectionState.CONNECTED
                                ? "listening"
                                : newState === ConnectionState.CONNECTING
                                    ? "thinking"
                                    : null,
                        }),
                        onTranscript: (sender, text, partial) => {
                            const newTranscript = [...get().transcript];

                            const existingIndex = newTranscript.findIndex(item => item.sender === sender && item.isPartial);

                            // partioal message exists, update it
                            if (existingIndex !== -1) {
                                newTranscript[existingIndex] = {
                                    ...newTranscript[existingIndex],
                                    text,
                                    isPartial: partial,
                                };

                                return { transcript: newTranscript };
                            } else {
                                if (text.trim() === "") return { transcript: newTranscript }; {
                                    newTranscript.push({
                                        id: `${sender}-${Date.now()}`,
                                        sender,
                                        text,
                                        isPartial: partial,
                                    });
                                }
                                return { transcript: newTranscript };
                            }
                        },
                        onAudioLevel: (level, type) => set((state) => ({
                            audioLevel: { ...state.audioLevel, [type]: level },
                        })),
                        onAgentState: (agentState) => set({ agentState }),
                        onError: (error: string) => set({ error }),
                    }, token.name);
                    set({ liveManagerInstance: manager })
                }


                // Create Live manager

                const language = AVAILABLE_LANGUAGES.find(({ code }) => code === state.selectedLanguage) ?? AVAILABLE_LANGUAGES[0];
                const proficiency = AVAILABLE_PROFICIENCY_LEVELS.find(({ id, label }) =>
                    id === state.selectedProficiencyLevel || label === state.selectedProficiencyLevel
                ) ?? AVAILABLE_PROFICIENCY_LEVELS[0];
                const voice = AVAILABLE_VOICES.find(({ id, name }) =>
                    id === state.selectedAssistantVoice || name === state.selectedAssistantVoice
                )?.name ?? state.selectedAssistantVoice;

                manager.startSession({
                    selected_topic: state.selectedTopic,
                    description: proficiency.description,
                    selected_launguage_name: language.name || 'English',
                    selected_launguage_code: language.code || 'en-us',
                    selected_launguage_region: language.region || 'United States',
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
            }

        }),
        { name: "TalkGyan Audio Store" },
    ),
);
