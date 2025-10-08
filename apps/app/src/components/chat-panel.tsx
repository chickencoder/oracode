import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { useState } from "react";
import { nanoid } from "nanoid";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useOrganization } from "@clerk/clerk-react";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ArrowUpIcon } from "lucide-react";
import { MODELS } from "@/lib/constants";
import { useOptimisticMessages } from "@/hooks/use-optimistic-messages";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";

interface ChatPanelProps {
  sessionId: Id<"sessions">;
  isSandboxReady: boolean;
}

export function ChatPanel({ sessionId, isSandboxReady }: ChatPanelProps) {
  const [model, setModel] = useState<string>(MODELS[0].id);

  const { organization, isLoaded } = useOrganization();

  const messages = useQuery(
    api.messages.getMessagesBySessionId,
    organization && isLoaded ? { sessionId } : "skip",
  );
  const insertUserMessage = useMutation(api.messages.insertUserMessage);

  const currentUser = useCurrentUser();
  const {
    displayMessages,
    isGenerating,
    hasOptimisticUserMessage,
    hasOptimisticAssistantMessage,
    addOptimisticMessage,
    clearOptimisticMessages,
  } = useOptimisticMessages({ messages });

  // Check if the last assistant message is still streaming
  const lastMessage = displayMessages[displayMessages.length - 1];
  const isAssistantStreaming =
    lastMessage?.role === "assistant" &&
    lastMessage.metadata?.isComplete === false;

  // Determine status based on optimistic messages
  const status = hasOptimisticUserMessage
    ? "submitted"
    : isGenerating || hasOptimisticAssistantMessage || isAssistantStreaming
      ? "streaming"
      : "ready";

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!isSandboxReady) return;

    const messageText = message.text?.trim();
    if (!messageText) return;

    const messageId = nanoid();

    // Show optimistic messages immediately
    addOptimisticMessage(messageText, messageId);

    try {
      await insertUserMessage({
        id: messageId,
        parts: [{ type: "text", text: messageText }],
        metadata: {},
        sessionId: sessionId,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      clearOptimisticMessages();
    }
  };

  return (
    <div className="w-96 flex flex-col min-h-0">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="pl-2 pr-4">
          <MessageRenderer
            messages={displayMessages}
            currentUser={currentUser}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput
        className="bg-card"
        globalDrop
        multiple
        onSubmit={handleSubmit}
      >
        <PromptInputBody>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputTextarea
            placeholder={
              isSandboxReady ? "Ask anything..." : "Waiting for sandbox..."
            }
            disabled={!isSandboxReady || isGenerating || isAssistantStreaming}
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputModelSelect onValueChange={setModel} value={model}>
              <PromptInputModelSelectTrigger>
                <PromptInputModelSelectValue />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent
                side="top"
                align="start"
                className="[--radius:0.95rem]"
              >
                {MODELS.map((modelOption) => (
                  <PromptInputModelSelectItem
                    key={modelOption.id}
                    value={modelOption.id}
                  >
                    {modelOption.name}
                  </PromptInputModelSelectItem>
                ))}
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>
          </PromptInputTools>
          <PromptInputSubmit
            status={status}
            variant="default"
            className="ml-auto"
            disabled={!isSandboxReady || isGenerating || isAssistantStreaming}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
