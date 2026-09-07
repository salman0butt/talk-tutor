import { LiveManager } from "@/services/liveManager";
import { AgentState, AudioVolume, ConnectionState } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type AudioStore = {
    connectionState: ConnectionState;
    error: string | null;
    isMuted: boolean;
    audioLevel: AudioVolume;
    agentState: AgentState;
    liveManagerInstance: LiveManager | null;
    connect: () => void;
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
            connect: async () => {
                const state = get();

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
                    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

                    if (!apiKey) {
                        set({ error: "Google API key is not configured" });
                        return;
                    }
                    manager = new LiveManager({
                        onStateChange: (newState: ConnectionState) => set({
                            connectionState: newState,
                            agentState: newState === ConnectionState.CONNECTED
                                ? "listening"
                                : newState === ConnectionState.CONNECTING
                                    ? "thinking"
                                    : null,
                        }),
                        onTranscript: () => {},
                        onAudioLevel: (level, type) => set((state) => ({
                            audioLevel: { ...state.audioLevel, [type]: level },
                        })),
                        onAgentState: (agentState) => set({ agentState }),
                        onError: (error: string) => set({ error }),
                    }, apiKey);
                    set({ liveManagerInstance: manager })
                }


                // Create Live manager

                manager.startSession();
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
