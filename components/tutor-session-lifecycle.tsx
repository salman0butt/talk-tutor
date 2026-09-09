"use client";

import { useEffect } from "react";
import { useAudioStore } from "@/store/useAudioStore";
import { ConnectionState } from "@/types";

export function TutorSessionLifecycle() {
  useEffect(() => {
    return () => {
      const state = useAudioStore.getState();
      if (state.connectionState !== ConnectionState.DISCONNECTED) {
        void state.disconnect();
      }
    };
  }, []);

  return null;
}
