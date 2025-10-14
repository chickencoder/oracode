"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex/_generated/api";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PermissionCardProps {
  id: string;
  toolName: string;
  toolInput: any;
  requestedAt: number;
}

function cleanFilePath(filePath: string): string {
  // Remove /home/oracode/project/ prefix
  return filePath.replace(/^\/home\/oracode\/project\//, "");
}

function getToolTitle(toolName: string, toolInput: any): string {
  switch (toolName) {
    case "Read":
      const readPath = toolInput?.file_path
        ? cleanFilePath(toolInput.file_path)
        : "a file";
      return `Read file ${readPath}`;
    case "Write":
      const writePath = toolInput?.file_path
        ? cleanFilePath(toolInput.file_path)
        : "a file";
      return `Create file ${writePath}`;
    case "Edit":
      const editPath = toolInput?.file_path
        ? cleanFilePath(toolInput.file_path)
        : "a file";
      return `Edit file ${editPath}`;
    case "Bash":
      const command = toolInput?.command || "a command";
      return `Run command`;
    case "Glob":
      return `Search for files`;
    case "Grep":
      return `Search in files`;
    case "WebFetch":
      return `Fetch from web`;
    case "WebSearch":
      return `Search the web`;
    default:
      return `Use ${toolName}`;
  }
}

function getToolQuestion(toolName: string, toolInput: any): string {
  switch (toolName) {
    case "Read":
      const readPath = toolInput?.file_path
        ? cleanFilePath(toolInput.file_path)
        : "this file";
      return `Do you want to allow Claude to read ${readPath}?`;
    case "Write":
      const writePath = toolInput?.file_path
        ? cleanFilePath(toolInput.file_path)
        : "this file";
      return `Do you want to allow Claude to create ${writePath}?`;
    case "Edit":
      const editPath = toolInput?.file_path
        ? cleanFilePath(toolInput.file_path)
        : "this file";
      return `Do you want to allow Claude to edit ${editPath}?`;
    case "Bash":
      const command = toolInput?.command || "a command";
      const preview =
        command.length > 80 ? command.substring(0, 80) + "..." : command;
      return `Do you want to run this command?\n\n${preview}`;
    case "Glob":
      return `Do you want to allow Claude to search for files matching ${toolInput?.pattern || "this pattern"}?`;
    case "Grep":
      return `Do you want to allow Claude to search for "${toolInput?.pattern || "content"}" in files?`;
    case "WebFetch":
      return `Do you want to allow Claude to fetch ${toolInput?.url || "this URL"}?`;
    case "WebSearch":
      return `Do you want to allow Claude to search the web for "${toolInput?.query || "this query"}"?`;
    default:
      return `Do you want to allow Claude to use ${toolName}?`;
  }
}

export function PermissionCard({
  id,
  toolName,
  toolInput,
  requestedAt,
}: PermissionCardProps) {
  const [isResolving, setIsResolving] = useState(false);
  const resolvePermission = useMutation(api.permissions.resolvePermission);

  const handleApprove = async () => {
    setIsResolving(true);
    try {
      await resolvePermission({
        id,
        approved: true,
      });
    } catch (error) {
      console.error("Failed to approve permission:", error);
      toast.error("Failed to approve permission");
      setIsResolving(false);
    }
  };

  const handleDeny = async () => {
    setIsResolving(true);
    try {
      await resolvePermission({
        id,
        approved: false,
        denialMessage: "User denied permission",
      });
    } catch (error) {
      console.error("Failed to deny permission:", error);
      toast.error("Failed to deny permission");
      setIsResolving(false);
    }
  };

  const title = getToolTitle(toolName, toolInput);
  const question = getToolQuestion(toolName, toolInput);

  return (
    <Card
      className={cn(
        "border-border bg-card",
        "animate-in slide-in-from-bottom-2 duration-300 gap-2 p-3",
      )}
    >
      <CardHeader className="px-3 pt-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>

      <CardContent className="px-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {question}
        </p>
      </CardContent>

      <CardFooter className="flex justify-end gap-2 px-0 pt-2">
        <Button onClick={handleApprove} disabled={isResolving} size="sm">
          Allow
        </Button>
        <Button
          onClick={handleDeny}
          disabled={isResolving}
          size="sm"
          variant="outline"
        >
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}
