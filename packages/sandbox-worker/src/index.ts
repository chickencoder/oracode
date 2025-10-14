import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import { config } from "dotenv";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type {
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";
import { v4 as uuidv4 } from "uuid";

import { logger } from "./utils/logger";
import type { MessagePart, UserMessage, StreamingState } from "./types";

config();

if (!process.env.CONVEX_URL) {
  logger.error("CONVEX_URL environment variable is required");
  process.exit(1);
}

if (!process.env.BRANCH_ID) {
  logger.error("BRANCH_ID environment variable is required");
  process.exit(1);
}

if (!process.env.CLERK_TOKEN) {
  logger.error("CLERK_TOKEN environment variable is required");
  process.exit(1);
}

logger.info("Starting sandbox worker", {
  nodeVersion: process.version,
  platform: process.platform,
  cwd: process.cwd(),
  convexUrl: process.env.CONVEX_URL?.substring(0, 50) + "...",
  sandboxId: process.env.SANDBOX_ID,
  branchId: process.env.BRANCH_ID,
  hasClerkToken: !!process.env.CLERK_TOKEN,
});

const client = new ConvexClient(process.env.CONVEX_URL!);

// Authenticate the Convex client with Clerk JWT token
logger.info("Setting Convex auth with Clerk token");
client.setAuth(() => {
  logger.info("Auth callback invoked, returning Clerk token");
  return Promise.resolve(process.env.CLERK_TOKEN || "");
});

const sandboxId = process.env.SANDBOX_ID || `sandbox-${Date.now()}`;
const branchId = process.env.BRANCH_ID! as Id<"branches">;

async function* generateUserMessages() {
  while (true) {
    const message = await new Promise<UserMessage | null>((resolve) => {
      if (streamingState.messageQueue.length > 0) {
        const nextMessage = streamingState.messageQueue.shift();
        resolve(nextMessage || null);
      } else {
        streamingState.messageQueueResolver = resolve;
      }
    });

    if (!message) continue;

    const userContent = message.parts
      ?.map((part: MessagePart) => {
        if (typeof part === "string") return part;
        return part.text || part.content || JSON.stringify(part);
      })
      .filter(Boolean)
      .join(" ");

    if (!userContent?.trim()) continue;

    if (!streamingState.currentProcessingMessage) {
      streamingState.currentProcessingMessage = message;
    }

    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: userContent,
      },
      parent_tool_use_id: null,
      session_id: streamingState.currentSessionId || sandboxId,
    };
  }
}

async function processStreamingSession() {
  if (streamingState.isStreamingSessionActive) return;

  streamingState.isStreamingSessionActive = true;
  const sessionOperation = logger.operation("streaming-session", {});

  try {
    let resumeSessionId: string | null = null;
    try {
      const currentBranch = await client.query(api.branches.getBranchById, {
        branchId: branchId,
      });

      if (currentBranch?.agentSessionId) {
        const existingMessages = await client.query(
          api.branches.getMessagesByBranchId,
          { branchId: branchId },
        );

        if (existingMessages.length > 0) {
          resumeSessionId = currentBranch.agentSessionId;
          logger.info("Found existing session to resume", {
            sessionId: resumeSessionId,
            messageCount: existingMessages.length,
          });
        }
      }
    } catch (error) {
      logger.warn("Could not fetch previous branch", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Set environment variables that Claude Code might need
    process.env.TERM = process.env.TERM || "xterm-256color";
    process.env.COLORTERM = "truecolor";

    const queryOptions: Options = {
      permissionMode: "default", // Changed from "bypassPermissions" - Claude Code refuses to run with bypass as root
      maxTurns: 50,
      model: "claude-sonnet-4-5-20250929",
      systemPrompt: { type: "preset", preset: "claude_code" },
      settingSources: [],
      includePartialMessages: true,
      ...(resumeSessionId && { resume: resumeSessionId }),
    };

    if (resumeSessionId) {
      streamingState.currentSessionId = resumeSessionId;
    }

    logger.info("Initializing Claude Agent SDK with streaming input", {
      resuming: !!resumeSessionId,
      model: "claude-sonnet-4-5-20250929",
    });

    const claudeQuery = query({
      prompt: generateUserMessages(),
      options: queryOptions,
    });

    let currentAssistantMessageId: string | null = null;
    let currentMessageChunks: Array<TextBlock | ToolUseBlock> = [];
    let currentUserMessageId: string | null = null;

    for await (const message of claudeQuery) {
      if (message.type === "user") {
        // Tool results from Claude - continue building the same assistant message
        continue;
      }

      if (message.type === "stream_event") {
        if (message.event.type === "content_block_start") {
          if (!currentAssistantMessageId) {
            currentAssistantMessageId = uuidv4();
            currentUserMessageId =
              streamingState.currentProcessingMessage?.id || null;
            streamingState.currentProcessingMessage = null;
          }

          const block = message.event.content_block;

          if (block.type === "text") {
            currentMessageChunks.push({
              type: "text" as const,
              text: block.text || "",
              citations: [],
            });
          } else if (block.type === "tool_use") {
            currentMessageChunks.push({
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: "",
            });
          }

          await updateAssistantMessage(
            currentAssistantMessageId,
            currentMessageChunks,
            currentUserMessageId,
            false,
          );
        } else if (message.event.type === "content_block_delta") {
          const lastChunk =
            currentMessageChunks[currentMessageChunks.length - 1];

          if (
            message.event.delta.type === "text_delta" &&
            lastChunk?.type === "text"
          ) {
            currentMessageChunks[currentMessageChunks.length - 1] = {
              ...lastChunk,
              text: lastChunk.text + message.event.delta.text,
            };
          } else if (
            message.event.delta.type === "input_json_delta" &&
            lastChunk?.type === "tool_use"
          ) {
            currentMessageChunks[currentMessageChunks.length - 1] = {
              ...lastChunk,
              input:
                (lastChunk.input as string) + message.event.delta.partial_json,
            };
          }

          if (currentAssistantMessageId) {
            await updateAssistantMessage(
              currentAssistantMessageId,
              currentMessageChunks,
              currentUserMessageId,
              false,
            );
          }
        } else if (message.event.type === "content_block_stop") {
          const lastChunk =
            currentMessageChunks[currentMessageChunks.length - 1];

          if (
            lastChunk?.type === "tool_use" &&
            typeof lastChunk.input === "string"
          ) {
            try {
              lastChunk.input = JSON.parse(lastChunk.input);
            } catch (error) {
              logger.error("Failed to parse tool input JSON", error as Error, {
                toolName: lastChunk.name,
                toolId: lastChunk.id,
              });
            }
          }

          if (currentAssistantMessageId) {
            await updateAssistantMessage(
              currentAssistantMessageId,
              currentMessageChunks,
              currentUserMessageId,
              false,
            );
          }
        }
      } else if (message.type === "result") {
        if (currentAssistantMessageId && currentMessageChunks.length > 0) {
          await finalizeAssistantMessage(
            currentAssistantMessageId,
            currentMessageChunks,
            currentUserMessageId,
          );
          currentAssistantMessageId = null;
          currentMessageChunks = [];
        }
      } else if (message.type === "system") {
        if (message.subtype === "init" && message.session_id) {
          streamingState.currentSessionId = message.session_id;

          try {
            await client.mutation(api.branches.updateBranchWithAgentId, {
              branchId: branchId,
              agentSessionId: message.session_id,
            });
            logger.info("Saved session ID to branch", {
              sessionId: message.session_id,
            });
          } catch (error) {
            logger.error(
              "Failed to update branch with agent ID",
              error as Error,
            );
          }
        }
      }
    }

    sessionOperation.success("Streaming session ended");
  } catch (error) {
    logger.error("Streaming session error", error as Error, {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: (error as any)?.code,
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    sessionOperation.error("Streaming session failed", error as Error);
  } finally {
    streamingState.isStreamingSessionActive = false;

    if (streamingState.messageQueue.length > 0) {
      logger.info("Processing queued messages after session end");
      processStreamingSession().catch((error) => {
        logger.error("Failed to restart streaming session", error as Error);
      });
    }
  }
}

async function updateAssistantMessage(
  messageId: string,
  parts: Array<TextBlock | ToolUseBlock>,
  inReplyToId: string | null,
  finalized: boolean,
) {
  try {
    await client.mutation(api.messages.upsertAssistantMessage, {
      id: messageId,
      parts: parts,
      branchId: branchId,
    });
  } catch (error) {
    logger.error("Failed to update assistant message", error as Error, {
      messageId,
      partCount: parts.length,
      finalized,
    });
  }
}

async function finalizeAssistantMessage(
  messageId: string,
  parts: Array<TextBlock | ToolUseBlock>,
  inReplyToId: string | null,
) {
  await updateAssistantMessage(messageId, parts, inReplyToId, true);
  logger.info("Finalized assistant message", {
    messageId,
    partCount: parts.length,
    inReplyToId,
  });
}

async function processUserMessage(userMessage: UserMessage | null) {
  if (
    !userMessage ||
    !userMessage.parts ||
    !Array.isArray(userMessage.parts)
  ) {
    logger.debug("Skipping invalid message", {
      hasMessage: !!userMessage,
      hasParts: !!userMessage?.parts,
      isArray: Array.isArray(userMessage?.parts),
    });
    return;
  }

  logger.info("Processing user message", {
    messageId: userMessage.id,
    isProcessing: streamingState.isStreamingSessionActive,
  });

  // If already processing a message, queue this one and resolve the queue if generator is waiting
  if (streamingState.isStreamingSessionActive) {
    logger.debug("Already processing a message, queueing");
    streamingState.messageQueue.push(userMessage);

    // If the generator is waiting for a message, resolve it
    if (streamingState.messageQueueResolver) {
      const resolver = streamingState.messageQueueResolver;
      streamingState.messageQueueResolver = null;
      resolver(userMessage);
    }
    return;
  }

  // Add to queue and start processing
  streamingState.messageQueue.push(userMessage);

  // Resolve any pending message queue resolver
  if (streamingState.messageQueueResolver) {
    const resolver = streamingState.messageQueueResolver;
    streamingState.messageQueueResolver = null;
    resolver(userMessage);
  }

  // Start streaming session if not active
  if (!streamingState.isStreamingSessionActive) {
    processStreamingSession().catch((error) => {
      logger.error("Failed to start streaming session", error as Error);
    });
  }
}

const streamingState: StreamingState = {
  hasInitialized: false,
  lastSeenMessageId: null,
  messageQueue: [],
  isStreamingSessionActive: false,
  currentSessionId: null,
  currentProcessingMessage: null,
  messageQueueResolver: null,
};

// Subscribe to messages from Convex
client.onUpdate(
  api.messages.getLastUserMessage,
  { branchId },
  (userMessage) => {
    logger.debug("Convex update received", {
      hasMessage: !!userMessage,
      messageId: userMessage?.id,
      isInitialized: streamingState.hasInitialized,
      lastSeenId: streamingState.lastSeenMessageId,
    });

    if (userMessage) {
      if (!streamingState.hasInitialized) {
        logger.info("First message received, initializing state", {
          messageId: userMessage.id,
        });
        streamingState.lastSeenMessageId = userMessage.id;
        streamingState.hasInitialized = true;
        return;
      }

      if (streamingState.lastSeenMessageId === userMessage.id) {
        logger.debug("Message already processed, skipping", {
          messageId: userMessage.id,
        });
        return;
      }

      logger.info("New user message detected", {
        messageId: userMessage.id,
        previousId: streamingState.lastSeenMessageId,
      });
      streamingState.lastSeenMessageId = userMessage.id;
      processUserMessage(userMessage).catch((error) => {
        logger.error("Error processing message", error as Error);
      });
    } else {
      if (!streamingState.hasInitialized) {
        logger.info("No messages yet, initializing as empty");
        streamingState.hasInitialized = true;
      }
    }
  },
);

logger.info("Worker subscribed to messages", {
  branchId,
  sandboxId,
});
