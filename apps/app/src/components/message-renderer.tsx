"use client";

import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { ToolParam } from "@/components/ai-elements/task";
import { LoadingText } from "@/components/loading-text";
import type { MessageData, UserInfo } from "@repo/convex/types";
import type { JSX } from "react";
import {
  Search,
  FileText,
  Pencil,
  FilePlus,
  Terminal,
  SearchCode,
  Bot,
  Globe,
} from "lucide-react";

interface MessageRendererProps {
  messages: MessageData[];
  currentUser: UserInfo | null;
}

const getToolIcon = (toolName: string) => {
  const iconProps = { className: "size-3.5 shrink-0" };
  switch (toolName) {
    case "Glob":
      return <Search {...iconProps} />;
    case "Read":
      return <FileText {...iconProps} />;
    case "Edit":
      return <Pencil {...iconProps} />;
    case "Write":
      return <FilePlus {...iconProps} />;
    case "Bash":
      return <Terminal {...iconProps} />;
    case "Grep":
      return <SearchCode {...iconProps} />;
    case "Task":
      return <Bot {...iconProps} />;
    case "WebFetch":
      return <Globe {...iconProps} />;
    case "WebSearch":
      return <Search {...iconProps} />;
    default:
      return null;
  }
};

const renderToolCall = (
  part: { name: string; input?: Record<string, unknown> },
  isComplete: boolean,
) => {
  const icon = getToolIcon(part.name);
  const fileName =
    typeof part.input?.file_path === "string"
      ? part.input.file_path.split("/").pop()
      : undefined;

  let label = "";
  let param: string | undefined;

  switch (part.name) {
    case "Glob":
      if (isComplete && typeof part.input?.pattern === "string") {
        label = "Searched for";
        param = part.input.pattern;
      } else {
        label = isComplete ? "Searched for files" : "Searching for files";
      }
      break;
    case "Read":
      if (isComplete && fileName) {
        label = "Read";
        param = fileName;
      } else {
        label = isComplete ? "Read file" : "Reading file";
      }
      break;
    case "Edit":
      if (isComplete && fileName) {
        label = "Edited";
        param = fileName;
      } else {
        label = isComplete ? "Edited file" : "Editing file";
      }
      break;
    case "Write":
      if (isComplete && fileName) {
        label = "Wrote";
        param = fileName;
      } else {
        label = isComplete ? "Wrote file" : "Writing file";
      }
      break;
    case "Bash":
      if (typeof part.input?.command === "string") {
        label = isComplete ? "Ran" : "Running";
        param =
          part.input.command.length > 40
            ? `${part.input.command.slice(0, 40)}...`
            : part.input.command;
      } else {
        label = isComplete ? "Ran command" : "Running command";
      }
      break;
    case "Grep":
      if (isComplete && typeof part.input?.pattern === "string") {
        label = "Searched for";
        param = part.input.pattern;
      } else {
        label = isComplete ? "Searched code" : "Searching code";
      }
      break;
    case "Task":
      label =
        typeof part.input?.description === "string"
          ? part.input.description
          : isComplete
            ? "Ran task"
            : "Running task";
      break;
    case "WebFetch":
      if (isComplete && typeof part.input?.url === "string") {
        label = "Fetched";
        param = part.input.url;
      } else {
        label = isComplete ? "Fetched content" : "Fetching content";
      }
      break;
    case "WebSearch":
      if (isComplete && typeof part.input?.query === "string") {
        label = "Searched";
        param = part.input.query;
      } else {
        label = isComplete ? "Searched web" : "Searching web";
      }
      break;
    default:
      label = part.name;
  }

  if (isComplete) {
    return (
      <div className="text-muted-foreground text-sm">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
          {param && <ToolParam>{param}</ToolParam>}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-sm">
      {icon}
      <LoadingText>
        <span className="inline-flex items-center gap-1.5">
          <span>{label}</span>
          {param && <ToolParam>{param}</ToolParam>}
        </span>
      </LoadingText>
    </div>
  );
};

export function MessageRenderer({
  messages,
  currentUser,
}: MessageRendererProps) {
  return (
    <>
      {messages.map((message) => {
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

        // Determine if message is complete
        const isMessageComplete = message.metadata?.isComplete === true;

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
                  <div className="space-y-3">
                    {message.parts.map((part, partIndex) => {
                      if (part.type === "text") {
                        return <Response key={partIndex}>{part.text}</Response>;
                      } else if (
                        part.type === "tool_use" &&
                        part.name !== "TodoWrite"
                      ) {
                        // Tool is loading if it's the last part and message is incomplete
                        const isLastPart =
                          partIndex === message.parts.length - 1;
                        const isToolLoading = isLastPart && !isMessageComplete;
                        // Add top margin if this is the first part (tool call starts the message)
                        const isFirstPart = partIndex === 0;

                        return (
                          <div
                            key={partIndex}
                            className={isFirstPart ? "mt-2" : ""}
                          >
                            {renderToolCall(
                              part as {
                                name: string;
                                input?: Record<string, unknown>;
                              },
                              !isToolLoading,
                            )}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </MessageContent>
            </Message>
          </div>
        );
      })}
    </>
  );
}
