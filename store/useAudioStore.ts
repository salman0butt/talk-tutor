import { LiveManager } from "@/services/liveManager";
import { ConnectionState } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type AudioStore = {
    connectionState: ConnectionState;
    error: string | null;
    liveManagerInstance: LiveManager | null;
    connect: () => void;

};


export const useAudioStore = create<AudioStore>()(
    devtools(
        (set, get) => ({
            connectionState: ConnectionState.DISCONNECTED,
            error: null,
            liveManagerInstance: null,
            connect: async () => {
                const state = get();

                if (state.connectionState === ConnectionState.CONNECTING || state.connectionState === ConnectionState.CONNECTED) {
                    return
                }

                set({ error: null })

                // Check Permission
                try {
                    await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                } catch {
                    set({ error: "Microphone permission denined" });
                }

                let manager = state.liveManagerInstance;

                if (!manager) {
                    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

                    if (!apiKey) {
                        set({ error: "Google API key is not configured" });
                        return;
                    }

                    manager = new LiveManager(apiKey);
                    set({ liveManagerInstance: manager })
                }


                // Create Live manager

                manager.startSession();
            }

        }),
        { name: "TalkGyan Audio Store" },
    ),
);
