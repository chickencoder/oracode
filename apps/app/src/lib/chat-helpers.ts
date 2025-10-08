import { nanoid } from "nanoid";
import type { MessageData } from "@repo/convex/types";

/**
 * Create a user message object
 */
export function createUserMessage(text: string, id?: string): MessageData {
  return {
    id: id ?? nanoid(),
    role: "user",
    parts: [{ type: "text", text }],
    metadata: {},
  };
}

/**
 * Create an optimistic assistant message (shown while waiting for response)
 */
export function createOptimisticAssistantMessage(): MessageData {
  return {
    id: `temp-${nanoid()}`,
    role: "assistant",
    parts: [],
    metadata: { isComplete: false },
  };
}
