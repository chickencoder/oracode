import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery, useAction } from "convex/react";
import { toast } from "sonner";
import { useOrganization } from "@clerk/clerk-react";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EnvVar {
  id?: string; // ID for existing vars (from database)
  key: string;
  value: string;
  isNew?: boolean; // Track if this is a new var being added
  isModified?: boolean; // Track if value was changed
  isDeleted?: boolean; // Track if marked for deletion
}

export function EnvironmentVariablesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { organization } = useOrganization();
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load environment variables from the new secure storage
  const existingVars = useQuery(
    api.variables.list,
    projectId && organization?.id
      ? { projectId: projectId as Id<"projects"> }
      : "skip",
  );

  const setEnvVar = useAction(api.variables.set);
  const removeEnvVar = useAction(api.variables.remove);

  // Load environment variables when data is available
  useEffect(() => {
    if (existingVars) {
      // Map database vars to UI state
      // Values are encrypted, so we show them as empty (user must re-enter to update)
      setEnvVars(
        existingVars.map((v) => ({
          id: v._id,
          key: v.key,
          value: "", // Don't show encrypted values
          isNew: false,
          isModified: false,
          isDeleted: false,
        })),
      );
    }
  }, [existingVars]);

  const parseEnvFile = (content: string): EnvVar[] => {
    const lines = content.split("\n");
    const parsed: EnvVar[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Remove surrounding quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, "");
        parsed.push({
          key: key,
          value: cleanValue,
          isNew: true,
          isModified: false,
          isDeleted: false,
        });
      }
    }

    return parsed;
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    const pastedText = e.clipboardData.getData("text");

    // Check if the pasted content looks like an env file (has = signs)
    const hasEqualsSign = pastedText.includes("=");

    if (hasEqualsSign) {
      e.preventDefault();

      try {
        const parsed = parseEnvFile(pastedText);
        if (parsed.length === 0) {
          // If no valid vars found, just paste normally
          return;
        }

        // Merge with existing vars, marking new ones
        const existingKeys = new Set(
          envVars.filter((v) => !v.isDeleted).map((v) => v.key),
        );
        const newVars = parsed.filter((v) => !existingKeys.has(v.key));

        if (newVars.length > 0) {
          setEnvVars([...envVars, ...newVars]);
          toast.success(
            `Added ${newVars.length} environment variable${newVars.length > 1 ? "s" : ""} from paste`,
          );
        } else {
          toast.info("All variables from paste already exist");
        }
      } catch (error) {
        // If parsing fails, just paste normally
        console.error("Failed to parse env file:", error);
      }
    }
    // Otherwise, let the default paste behavior happen
  };

  const handleSave = async () => {
    if (!projectId) return;

    setIsSaving(true);
    try {
      // Process deletions first
      const deletions = envVars.filter((v) => v.isDeleted && !v.isNew);
      for (const envVar of deletions) {
        try {
          await removeEnvVar({
            projectId: projectId as Id<"projects">,
            key: envVar.key,
          });
        } catch (error) {
          console.error(`Failed to delete ${envVar.key}:`, error);
          throw new Error(`Failed to delete ${envVar.key}`);
        }
      }

      // Process additions and updates
      const updates = envVars.filter(
        (v) => !v.isDeleted && (v.isNew || v.isModified),
      );
      for (const envVar of updates) {
        // Only save if there's a value (required for new vars and updates)
        if (envVar.value.trim()) {
          try {
            await setEnvVar({
              projectId: projectId as Id<"projects">,
              key: envVar.key,
              value: envVar.value,
            });
          } catch (error) {
            console.error(`Failed to set ${envVar.key}:`, error);
            throw new Error(`Failed to set ${envVar.key}`);
          }
        }
      }

      toast.success("Environment variables updated successfully");

      // Remove deleted vars from state and reset modified flags
      setEnvVars((vars) =>
        vars
          .filter((v) => !v.isDeleted)
          .map((v) => ({
            ...v,
            value: "", // Clear values after save
            isNew: false,
            isModified: false,
          })),
      );
    } catch (error) {
      console.error("Failed to update environment variables:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update environment variables",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNew = () => {
    setEnvVars([
      ...envVars,
      { key: "", value: "", isNew: true, isModified: false, isDeleted: false },
    ]);
  };

  const handleDelete = (index: number) => {
    const updated = [...envVars];
    if (updated[index].isNew) {
      // If it's a new var that hasn't been saved, just remove it
      setEnvVars(envVars.filter((_, i) => i !== index));
    } else {
      // Mark existing var for deletion
      updated[index].isDeleted = true;
      setEnvVars(updated);
    }
  };

  const handleUpdateKey = (index: number, newKey: string) => {
    const updated = [...envVars];
    updated[index].key = newKey;
    updated[index].isModified = true;
    setEnvVars(updated);
  };

  const handleUpdateValue = (index: number, newValue: string) => {
    const updated = [...envVars];
    updated[index].value = newValue;
    updated[index].isModified = true;
    setEnvVars(updated);
  };

  const isLoading = existingVars === undefined;
  const visibleVars = envVars.filter((v) => !v.isDeleted);
  const hasChanges = envVars.some(
    (v) => v.isNew || v.isModified || v.isDeleted,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>
            Manage environment variables for your project. These are securely
            encrypted and injected into your development environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 min-h-[242px]">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Paste your .env file contents to automatically import all
              variables
            </AlertDescription>
          </Alert>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 h-10 bg-muted animate-pulse rounded" />
                  <div className="flex-1 h-10 bg-muted animate-pulse rounded" />
                  <div className="h-10 w-10 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleVars.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <h3 className="text-sm font-medium mb-1">
                    No environment variables
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Get started by adding your first environment variable.
                  </p>
                </div>
              ) : (
                <>
                  {visibleVars.map((envVar, index) => {
                    const actualIndex = envVars.indexOf(envVar);
                    return (
                      <div
                        key={envVar.id || `new-${actualIndex}`}
                        className="flex items-center gap-2"
                      >
                        <Input
                          value={envVar.key}
                          onChange={(e) =>
                            handleUpdateKey(actualIndex, e.target.value)
                          }
                          onPaste={(e) => handlePaste(e, actualIndex)}
                          placeholder="KEY_NAME"
                          className="flex-1 font-mono text-sm"
                          disabled={!envVar.isNew}
                        />
                        <Input
                          value={
                            envVar.value ||
                            (!envVar.isNew ? "••••••••••••••••" : "")
                          }
                          onChange={(e) =>
                            handleUpdateValue(actualIndex, e.target.value)
                          }
                          onPaste={(e) => handlePaste(e, actualIndex)}
                          onFocus={(e) => {
                            if (
                              !envVar.isNew &&
                              e.target.value === "••••••••••••••••"
                            ) {
                              handleUpdateValue(actualIndex, "");
                            }
                          }}
                          placeholder={
                            envVar.isNew ? "Value" : "Enter new value to update"
                          }
                          type="password"
                          className="flex-1 font-mono text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(actualIndex)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <Button
            onClick={handleAddNew}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Variable
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || isLoading}
            loading={isSaving}
          >
            Save
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
