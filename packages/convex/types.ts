// Base UIMessage types following Vercel AI SDK standard
export interface UIMessagePart {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
  [key: string]: any;
}

export interface BaseUIMessage {
  id: string;
  role: "system" | "user" | "assistant";
  parts: UIMessagePart[];
  metadata?: Record<string, any>;
}

// Custom metadata type for our application
export interface AppMetadata {
  timestamp?: string;
  source?: string;
  sandboxId?: string;
  isComplete?: boolean;
  [key: string]: any;
}

// Our custom UIMessage type
export type AppUIMessage = BaseUIMessage & {
  metadata?: AppMetadata;
};

// Message data type as returned from Convex queries
export interface MessageData {
  _id: string;
  _creationTime: number;
  id: string;
  role: "user" | "assistant" | "system";
  parts: UIMessagePart[];
  metadata?: AppMetadata;
  sessionId: string;
  userId: string;
  orgId: string;
}

// User info for displaying avatars and names
export interface UserInfo {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}
