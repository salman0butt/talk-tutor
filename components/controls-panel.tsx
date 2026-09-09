"use client";

import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MicSelector } from "@/components/ui/mic-selector";
import { cn } from "@/lib/utils";
import { useAudioStore } from "@/store/useAudioStore";
import { ConnectionState } from "@/types";

function ControlsPanel() {
  const {
    connect,
    disconnect,
    connectionState,
    isMuted,
    toggleMute,
    selectedInputDeviceId,
    setSelectedInputDeviceId,
  } = useAudioStore();

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isRequestingPermission =
    connectionState === ConnectionState.REQUESTING_PERMISSION;
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  const isDisconnecting =
    connectionState === ConnectionState.DISCONNECTING;
  const hasActiveAttempt =
    isConnected || isRequestingPermission || isConnecting || isDisconnecting;

  return (
    <div className="mx-auto w-full max-w-[90vw] transition-all duration-300 ease-in-out sm:max-w-fit">
      <div
        className={cn(
          "flex items-center justify-between gap-3 p-3 sm:justify-center sm:gap-4 sm:p-2",
          "rounded-2xl sm:rounded-full",
          "border",
          "backdrop-blur-xl shadow-xl dark:shadow-black/50",
          "transition-all duration-300",
        )}
      >
        <div className="min-w-0 flex-1 sm:flex-none sm:px-2">
          <MicSelector
            value={selectedInputDeviceId}
            onValueChange={setSelectedInputDeviceId}
            muted={isConnected ? isMuted : undefined}
            onMutedChange={(muted) => {
              if (isConnected && muted !== isMuted) {
                toggleMute();
              }
            }}
            disabled={isDisconnecting}
            className="w-full sm:w-auto"
          />
        </div>

        <div className="mx-1 hidden h-8 w-px sm:block" />

        <div className="flex shrink-0 items-center gap-2">
          {isConnected && (
            <Button
              onClick={toggleMute}
              variant="secondary"
              size="icon"
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={isMuted}
              className={cn(
                "h-12 w-12 rounded-full",
                isMuted
                  ? "border-red-200 bg-red-100 text-red-600 hover:bg-red-200 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-500"
                  : "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800",
              )}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}

          {!hasActiveAttempt ? (
            <Button
              onClick={() => {
                void connect();
              }}
              size="lg"
              className={cn(
                "h-12 rounded-xl px-6 sm:h-11 sm:rounded-full",
                "bg-primary font-semibold text-primary-foreground",
                "transition-all duration-300 active:scale-95",
              )}
            >
              <Mic className="mr-2 h-5 w-5" />
              <span>Connect</span>
            </Button>
          ) : (
            <Button
              onClick={() => {
                void disconnect();
              }}
              disabled={isDisconnecting}
              variant="destructive"
              size="lg"
              className={cn(
                "h-12 rounded-xl px-6 sm:h-11 sm:rounded-full",
                "shadow-md hover:shadow-lg",
                "transition-all duration-300 active:scale-95",
              )}
            >
              {isDisconnecting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <PhoneOff className="mr-2 h-5 w-5" />
              )}
              <span>
                {isDisconnecting
                  ? "Ending..."
                  : isRequestingPermission || isConnecting
                    ? "Cancel"
                    : "End"}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ControlsPanel;
