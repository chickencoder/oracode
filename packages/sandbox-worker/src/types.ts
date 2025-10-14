// Convex database schema types
export interface MessagePart {
  text?: string;
  content?: string;
  [key: string]: unknown;
}

export interface UserMessage {
  id: string;
  parts: MessagePart[];
}

// Application state management
export interface StreamingState {
  hasInitialized: boolean;
  lastSeenMessageId: string | null;
  messageQueue: UserMessage[];
  isStreamingSessionActive: boolean;
  currentSessionId: string | null;
  currentProcessingMessage: UserMessage | null;
  messageQueueResolver: ((message: UserMessage | null) => void) | null;
}