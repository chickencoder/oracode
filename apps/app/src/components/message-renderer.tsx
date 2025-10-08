"use client";

import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/components/ai-elements/task";
import { LoadingText } from "@/components/loading-text";
import type { MessageData, UserInfo } from "@repo/convex/types";
import type { JSX } from "react";

interface MessageRendererProps {
  messages: MessageData[];
  currentUser: UserInfo | null;
}

const getToolActiveVerb = (toolName: string): string => {
  switch (toolName) {
    case "Glob":
      return "Searching files";
    case "Read":
      return "Reading files";
    case "Edit":
      return "Editing files";
    case "Write":
      return "Writing files";
    case "Bash":
      return "Running command";
    case "Grep":
      return "Searching code";
    case "Task":
      return "Running task";
    case "WebFetch":
      return "Fetching content";
    case "WebSearch":
      return "Searching web";
    case "TodoWrite":
      return "Updating tasks";
    default:
      return `Using ${toolName}`;
  }
};

const getToolDescription = (part: {
  name: string;
  input?: Record<string, unknown>;
}) => {
  const fileName =
    typeof part.input?.file_path === "string"
      ? part.input.file_path.split("/").pop()
      : undefined;

  switch (part.name) {
    case "Glob":
      return (
        <span className="flex items-center gap-2">
          Searching for{" "}
          <TaskItemFile>
            {typeof part.input?.pattern === "string"
              ? part.input.pattern
              : "files"}
          </TaskItemFile>
        </span>
      );
    case "Read":
      return (
        <span className="flex items-center gap-2">
          Reading <TaskItemFile>{fileName || "file"}</TaskItemFile>
        </span>
      );
    case "Edit":
      return (
        <span className="flex items-center gap-2">
          Editing <TaskItemFile>{fileName || "file"}</TaskItemFile>
        </span>
      );
    case "Write":
      return (
        <span className="flex items-center gap-2">
          Writing <TaskItemFile>{fileName || "file"}</TaskItemFile>
        </span>
      );
    case "Bash":
      const cmd =
        typeof part.input?.command === "string" ? part.input.command : "bash";
      return (
        <span className="flex items-center gap-2">
          Running{" "}
          <TaskItemFile>
            {cmd.length > 40 ? `${cmd.slice(0, 40)}...` : cmd}
          </TaskItemFile>
        </span>
      );
    case "Grep":
      return (
        <span className="flex items-center gap-2">
          Searching for{" "}
          <TaskItemFile>
            {typeof part.input?.pattern === "string"
              ? part.input.pattern
              : "pattern"}
          </TaskItemFile>
        </span>
      );
    case "Task":
      return typeof part.input?.description === "string"
        ? part.input.description
        : "Running task";
    case "WebFetch":
      return (
        <span className="flex items-center gap-2">
          Fetching{" "}
          <TaskItemFile>
            {typeof part.input?.url === "string"
              ? part.input.url
              : "web content"}
          </TaskItemFile>
        </span>
      );
    case "WebSearch":
      return (
        <span className="flex items-center gap-2">
          Searching:{" "}
          <TaskItemFile>
            {typeof part.input?.query === "string" ? part.input.query : "query"}
          </TaskItemFile>
        </span>
      );
    default:
      return part.name;
  }
};

export function MessageRenderer({
  messages,
  currentUser,
}: MessageRendererProps) {
  return (
    <>
      {messages.map((message, messageIndex) => {
        // Determine avatar and name based on role and user ID
        const isCurrentUser =
          message.role === "user" &&
          currentUser &&
          message.userId === currentUser.id;
        const isAssistant = message.role === "assistant";

        const avatarSrc = isAssistant
          ? "/claude.png"
          : isCurrentUser && currentUser.avatarUrl
            ? currentUser.avatarUrl
            : "https://static.landing.so/avatars/male-1.png";

        const userName = isAssistant
          ? "Claude"
          : isCurrentUser && currentUser.name
            ? currentUser.name
            : "User";

        const isEmptyAssistantMessage =
          isAssistant && message.parts.length === 0;

        // Check if this message has tool calls and is complete
        const toolParts = message.parts.filter(
          (p) => p.type === "tool_use" && p.name !== "TodoWrite",
        );
        const hasToolCalls = toolParts.length > 0;
        const nextMessage = messages[messageIndex + 1];
        const isComplete =
          hasToolCalls &&
          (message.metadata?.isComplete ||
            (nextMessage && nextMessage.role === "user"));

        return (
          <div key={message._id}>
            <Message from="system">
              <MessageContent variant="flat">
                <div className="inline-flex items-center gap-2">
                  <MessageAvatar
                    src={avatarSrc}
                    name={userName}
                    className="size-4 ring-0"
                  />
                  <span className="font-medium">{userName}</span>
                </div>

                {isEmptyAssistantMessage ? (
                  <LoadingText>Thinking...</LoadingText>
                ) : (
                  (() => {
                    const elements: JSX.Element[] = [];
                    let i = 0;

                    while (i < message.parts.length) {
                      const part = message.parts[i];

                      if (part.type === "text") {
                        elements.push(<Response key={i}>{part.text}</Response>);
                        i++;
                      } else if (
                        part.type === "tool_use" &&
                        part.name !== "TodoWrite"
                      ) {
                        // Collect adjacent tool calls
                        const adjacentTools: typeof message.parts = [];
                        let j = i;
                        while (
                          j < message.parts.length &&
                          message.parts[j].type === "tool_use" &&
                          message.parts[j].name !== "TodoWrite"
                        ) {
                          adjacentTools.push(message.parts[j]);
                          j++;
                        }

                        // Calculate execution time and show summary
                        let taskTitle: string;
                        const taskCount = adjacentTools.length;

                        if (isComplete && nextMessage) {
                          const executionTimeMs =
                            nextMessage._creationTime - message._creationTime;
                          const executionTimeSec = Math.round(
                            executionTimeMs / 1000,
                          );
                          taskTitle = `Executed ${taskCount} task${taskCount === 1 ? "" : "s"}`;
                        } else {
                          // Show present tense while in progress using first tool's verb
                          const firstTool = adjacentTools[0] as
                            | { name: string; input?: Record<string, unknown> }
                            | undefined;
                          taskTitle = firstTool
                            ? getToolActiveVerb(firstTool.name)
                            : "Working";
                        }

                        elements.push(
                          <Task key={i} className="my-2">
                            <TaskTrigger title={taskTitle} />
                            <TaskContent>
                              {adjacentTools.map((toolPart, toolIndex) => (
                                <TaskItem key={toolIndex}>
                                  {getToolDescription(
                                    toolPart as {
                                      name: string;
                                      input?: Record<string, unknown>;
                                    },
                                  )}
                                </TaskItem>
                              ))}
                            </TaskContent>
                          </Task>,
                        );

                        i = j; // Skip past all the tools we just processed
                      } else {
                        // Skip TodoWrite or any other part types
                        i++;
                      }
                    }

                    return elements;
                  })()
                )}
              </MessageContent>
            </Message>
          </div>
        );
      })}
    </>
  );
}
