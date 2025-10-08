import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageRenderer } from "@/components/message-renderer";
import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import { useState, useEffect } from "react";
import { nanoid } from "nanoid";
import type { Id } from "@repo/convex/_generated/dataModel";
import type { MessageData, UserInfo } from "@repo/convex/types";
import { useUser, useOrganization } from "@clerk/clerk-react";
import { InputGroup } from "@/components/ui/input-group";
import { InputGroupTextarea } from "@/components/ui/input-group";
import { InputGroupAddon } from "@/components/ui/input-group";
import { InputGroupButton } from "@/components/ui/input-group";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { IconPlus } from "@tabler/icons-react";
import { ArrowUpIcon } from "lucide-react";
import { LoadingText } from "@/components/loading-text";

interface ConversationPanelProps {
  sessionId: Id<"sessions">;
  isSandboxReady: boolean;
}

export function ConversationPanel({
  sessionId,
  isSandboxReady,
}: ConversationPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [input, setInput] = useState("");

  const { organization, isLoaded } = useOrganization();
  const messages = useQuery(
    api.messages.getMessagesBySessionId,
    organization && isLoaded ? { sessionId } : "skip",
  );
  const insertUserMessage = useMutation(api.messages.insertUserMessage);
  const { user } = useUser();

  // Create current user info for avatar display
  const currentUser: UserInfo | null = user
    ? {
        id: user.id,
        name: user.fullName || user.firstName || "User",
        avatarUrl: user.imageUrl || null,
      }
    : null;

  const lastAssistantMessage = messages
    ? [...messages]
        .filter((message) => message.role === "assistant")
        .sort((a, b) => b._creationTime - a._creationTime)[0]
    : undefined;

  const isGenerating =
    lastAssistantMessage?.metadata?.isComplete === false || isSubmitting;

  const handleSubmit = async () => {
    if (input.trim() && isSandboxReady) {
      setIsSubmitting(true);
      setShowThinking(true);
      try {
        await insertUserMessage({
          id: nanoid(),
          parts: [{ type: "text", text: input.trim() }],
          metadata: {},
          sessionId: sessionId,
        });
        setInput("");
      } catch (error) {
        console.error("Failed to send message:", error);
      } finally {
        setIsSubmitting(false);
        setShowThinking(false);
      }
    }
  };

  // Hide thinking state once we get a real assistant message
  useEffect(() => {
    if (showThinking && lastAssistantMessage) {
      setShowThinking(false);
    }
  }, [showThinking, lastAssistantMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-96 flex flex-col min-h-0">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="pl-2 pr-4">
          {messages && messages.length > 0 ? (
            <>
              <MessageRenderer
                messages={messages as MessageData[]}
                currentUser={currentUser}
              />
              {showThinking && (
                <Message from="system">
                  <MessageContent variant="flat">
                    <div className="inline-flex items-center gap-2">
                      <MessageAvatar
                        src="/claude.png"
                        name="Assistant"
                        className="size-4 ring-0"
                      />
                      <span className="font-medium">Claude</span>
                    </div>
                    <LoadingText>Thinking...</LoadingText>
                  </MessageContent>
                </Message>
              )}
            </>
          ) : (
            <ConversationEmptyState
              title="No messages yet"
              description="Start a conversation with your sandbox"
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <InputGroup className="bg-card">
        <InputGroupTextarea
          placeholder={
            isSandboxReady ? "Ask, Search or Chat..." : "Waiting for sandbox..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isSandboxReady || isSubmitting}
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            variant="outline"
            className="rounded-full"
            size="icon-xs"
          >
            <IconPlus />
          </InputGroupButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <InputGroupButton variant="ghost">Sonnet 4.5</InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="[--radius:0.95rem]"
            >
              <DropdownMenuItem>Sonnet 4.5</DropdownMenuItem>
              <DropdownMenuItem>Agent</DropdownMenuItem>
              <DropdownMenuItem>Manual</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <InputGroupButton
            variant="default"
            className="rounded-full ml-auto"
            size="icon-xs"
            disabled={!isSandboxReady || isSubmitting || !input.trim()}
            onClick={handleSubmit}
            loading={isGenerating}
          >
            <ArrowUpIcon />
            <span className="sr-only">Send</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
