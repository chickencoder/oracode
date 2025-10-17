import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { nanoid } from "nanoid";
import type { Id } from "@repo/convex/_generated/dataModel";
import { useOrganization } from "@clerk/clerk-react";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";
import { useOptimisticMessages } from "@/hooks/use-optimistic-messages";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { PermissionCard } from "@/components/permission-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface ChatPanelProps {
  branchId: Id<"branches"> | undefined;
  isSandboxReady: boolean;
}

export function ChatPanel({ branchId, isSandboxReady }: ChatPanelProps) {
  const { organization, isLoaded } = useOrganization();

  const messages = useQuery(
    api.messages.getMessagesByBranchId,
    organization && isLoaded && branchId ? { branchId } : "skip",
  );
  const insertUserMessage = useMutation(api.messages.insertUserMessage);

  // Permission mode
  const permissionMode = useQuery(
    api.permissions.getPermissionMode,
    branchId ? { branchId } : "skip",
  );
  const setPermissionMode = useMutation(api.permissions.setPermissionMode);

  // Pending permissions
  const pendingPermissions = useQuery(
    api.permissions.getPendingPermissions,
    branchId ? { branchId } : "skip",
  );

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

  // Determine status - show streaming for any message activity
  const status =
    hasOptimisticUserMessage ||
    isGenerating ||
    hasOptimisticAssistantMessage ||
    isAssistantStreaming
      ? "streaming"
      : "ready";

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!isSandboxReady) {
      toast.error("Sandbox isn't ready yet. Please wait...");
      return;
    }

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
        branchId: branchId as Id<"branches">,
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
        <ConversationContent className="pl-2 pr-4 pt-0">
          <MessageRenderer
            messages={displayMessages}
            currentUser={currentUser}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Permission cards - fixed above input */}
      {pendingPermissions && pendingPermissions.length > 0 && (
        <div className="pb-2 space-y-2 max-h-[300px] overflow-y-auto">
          {pendingPermissions.map((permission) => (
            <PermissionCard
              key={permission.id}
              id={permission.id}
              toolName={permission.toolName}
              toolInput={permission.toolInput}
              requestedAt={permission.requestedAt}
            />
          ))}
        </div>
      )}

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
            placeholder="Ask anything..."
            disabled={isGenerating || isAssistantStreaming}
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <Tooltip>
            <TooltipTrigger asChild>
              <PromptInputSubmit
                status={status}
                variant="default"
                className="ml-auto"
                disabled={
                  !isSandboxReady || isGenerating || isAssistantStreaming
                }
              />
            </TooltipTrigger>
            {!isSandboxReady && (
              <TooltipContent>Sandbox isn't ready yet</TooltipContent>
            )}
          </Tooltip>
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
