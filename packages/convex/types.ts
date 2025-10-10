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

// Secret management types
export interface EncryptionMetadata {
  iv: string; // Initialization vector (base64)
  algorithm: string; // e.g., "AES-256-GCM"
  version: number; // Encryption scheme version
}

export interface EncryptedData {
  encryptedValue: string; // base64 encoded
  encryptionMetadata: EncryptionMetadata;
}

export interface Secret {
  _id: string;
  encryptedValue: string;
  encryptionMetadata: EncryptionMetadata;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface OrganizationSettings {
  _id: string;
  orgId: string;
  anthropicApiKey?: string; // Reference to secret ID
  createdAt: number;
  updatedAt: number;
}

export interface ProjectEnvironmentVariable {
  _id: string;
  projectId: string;
  key: string;
  secretId: string; // Reference to secret
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}
