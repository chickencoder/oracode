import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { MessageData } from "@repo/convex/types";
import { OPTIMISTIC_ASSISTANT_DELAY } from "@/lib/constants";
import {
  createUserMessage,
  createOptimisticAssistantMessage,
} from "@/lib/chat-helpers";

interface UseOptimisticMessagesProps {
  messages: MessageData[] | undefined;
}

interface UseOptimisticMessagesReturn {
  displayMessages: MessageData[];
  isGenerating: boolean;
  hasOptimisticUserMessage: boolean;
  hasOptimisticAssistantMessage: boolean;
  addOptimisticMessage: (text: string, id: string) => void;
  clearOptimisticMessages: () => void;
}

/**
 * Custom hook to manage optimistic message updates for chat
 * Handles showing messages immediately before they're confirmed by the server
 */
export function useOptimisticMessages({
  messages,
}: UseOptimisticMessagesProps): UseOptimisticMessagesReturn {
  const [optimisticUserMessage, setOptimisticUserMessage] =
    useState<MessageData | null>(null);
  const [optimisticAssistantMessage, setOptimisticAssistantMessage] =
    useState<MessageData | null>(null);
  const [lastAssistantMessageId, setLastAssistantMessageId] = useState<
    string | null
  >(null);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Combine real messages with optimistic messages
  const displayMessages = useMemo(() => {
    const realMessages = messages || [];
    const allMessages: MessageData[] = [...realMessages];

    // Only add optimistic user message if it's not already in real messages
    if (
      optimisticUserMessage &&
      !realMessages.find((m) => m.id === optimisticUserMessage.id)
    ) {
      allMessages.push(optimisticUserMessage);
    }

    if (optimisticAssistantMessage) {
      allMessages.push(optimisticAssistantMessage);
    }

    return allMessages;
  }, [messages, optimisticUserMessage, optimisticAssistantMessage]);

  const lastAssistantMessage = useMemo(
    () =>
      messages
        ? [...messages]
            .filter((message) => message.role === "assistant")
            .sort((a, b) => b._creationTime - a._creationTime)[0]
        : undefined,
    [messages],
  );

  // Clear optimistic user message when it appears in real messages
  useEffect(() => {
    if (
      optimisticUserMessage &&
      messages?.find((m) => m.id === optimisticUserMessage.id)
    ) {
      setOptimisticUserMessage(null);
      // Keep waiting flag set until assistant responds
    }
  }, [messages, optimisticUserMessage]);

  // Clear optimistic assistant message when a NEW assistant message arrives
  // Keep waiting state active until message completes
  useEffect(() => {
    if (
      lastAssistantMessage &&
      lastAssistantMessage._id !== lastAssistantMessageId
    ) {
      setOptimisticAssistantMessage(null);
      setLastAssistantMessageId(lastAssistantMessage._id);
    }

    // Clear waiting state only when the current message finishes streaming
    if (
      lastAssistantMessage &&
      waitingForResponse &&
      lastAssistantMessage.metadata?.isComplete !== false
    ) {
      setWaitingForResponse(false);
    }
  }, [lastAssistantMessage, lastAssistantMessageId, waitingForResponse]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const isGenerating =
    lastAssistantMessage?.metadata?.isComplete === false ||
    optimisticAssistantMessage !== null ||
    waitingForResponse;

  const addOptimisticMessage = useCallback((text: string, id: string) => {
    const userMessage = createUserMessage(text, id) as MessageData;
    const assistantMessage = createOptimisticAssistantMessage() as MessageData;

    // Show optimistic user message immediately
    setOptimisticUserMessage(userMessage);
    setWaitingForResponse(true);

    // Show optimistic assistant message after a slight delay
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setOptimisticAssistantMessage(assistantMessage);
    }, OPTIMISTIC_ASSISTANT_DELAY);
  }, []);

  const clearOptimisticMessages = useCallback(() => {
    setOptimisticUserMessage(null);
    setOptimisticAssistantMessage(null);
    setWaitingForResponse(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    displayMessages,
    isGenerating,
    hasOptimisticUserMessage: optimisticUserMessage !== null,
    hasOptimisticAssistantMessage: optimisticAssistantMessage !== null,
    addOptimisticMessage,
    clearOptimisticMessages,
  };
}
