"use client";

import { LucideLanguages } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ui/conversation";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import { cleanText } from "@/lib/utils";
import { useAudioStore } from "@/store/useAudioStore";
import SidebarHeader from "./sidebar-header";

function RightSidebar() {
  const items = useAudioStore((state) => state.transcriptState.messages);

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <SidebarHeader icon={LucideLanguages} title="Transcript" />

      <div className="relative flex-1 overflow-hidden">
        <Conversation className="h-full overflow-y-auto px-3 py-2">
          <ConversationContent className="space-y-2">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center opacity-50">
                <ConversationEmptyState
                  title=""
                  description="Start speaking..."
                  className="text-center text-xs"
                />
              </div>
            ) : (
              items.map((message) => {
                const cleanedText = cleanText(message.text);
                const isStreaming = message.status === "streaming";
                if (!cleanedText && !isStreaming) return null;

                const isUser = message.speaker === "user";
                return (
                  <Message
                    key={message.id}
                    from={isUser ? "user" : "assistant"}
                  >
                    <MessageContent
                      className={
                        !isUser
                          ? "bg-primary! text-primary-foreground!"
                          : "bg-secondary! text-secondary-foreground!"
                      }
                    >
                      {cleanedText}
                      {isStreaming && (
                        <span
                          className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full opacity-60 align-baseline"
                          aria-label="Transcribing"
                        />
                      )}
                    </MessageContent>

                    {!isUser && (
                      <MessageAvatar
                        src="/logo-tutor.png"
                        name="Talk Tutor"
                      />
                    )}
                  </Message>
                );
              })
            )}
          </ConversationContent>
          <ConversationScrollButton aria-label="Scroll to latest transcript" />
        </Conversation>
      </div>
    </aside>
  );
}

export default RightSidebar;
