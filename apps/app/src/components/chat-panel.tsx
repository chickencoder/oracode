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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODELS } from "@/lib/constants";
import { useOptimisticMessages } from "@/hooks/use-optimistic-messages";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { PermissionCard } from "@/components/permission-card";

interface ChatPanelProps {
  branchId: Id<"branches">;
  isSandboxReady: boolean;
}

export function ChatPanel({ branchId, isSandboxReady }: ChatPanelProps) {
  const [model, setModel] = useState<string>(MODELS[0].id);

  const { organization, isLoaded } = useOrganization();

  const messages = useQuery(
    api.messages.getMessagesByBranchId,
    organization && isLoaded ? { branchId } : "skip",
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
        branchId: branchId,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      clearOptimisticMessages();
    }
  };

  const handlePermissionModeChange = async (
    mode: "default" | "acceptEdits" | "bypassPermissions",
  ) => {
    try {
      await setPermissionMode({ branchId, mode });
      toast.success(
        `Permission mode set to ${mode === "default" ? "Ask First" : mode === "acceptEdits" ? "Auto-approve Edits" : "Allow All"}`,
      );
    } catch (error) {
      console.error("Failed to update permission mode:", error);
      toast.error("Failed to update permission mode");
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
            {/* Permission Mode Selector */}
            <Select
              value={permissionMode || "default"}
              onValueChange={handlePermissionModeChange}
            >
              <SelectTrigger size="sm" className="w-fit gap-1.5">
                <Shield className="size-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top" align="start">
                <SelectItem value="default">Ask First</SelectItem>
                <SelectItem value="acceptEdits">Auto-approve Edits</SelectItem>
                <SelectItem value="bypassPermissions">
                  <span className="text-destructive">Allow All</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <PromptInputModelSelect onValueChange={setModel} value={model}>
              <PromptInputModelSelectTrigger>
                <PromptInputModelSelectValue />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent side="top" align="start">
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
