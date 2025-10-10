import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@repo/convex/_generated/api";
import type { Id } from "@repo/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

export function EnvironmentVariablesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    [],
  );
  const [newVars, setNewVars] = useState<Array<{ key: string; value: string }>>(
    [],
  );
  const [isSaving, setIsSaving] = useState(false);

  const project = useQuery(
    api.projects.getProjectById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const updateEnvironmentVariables = useMutation(
    api.projects.updateEnvironmentVariables,
  );

  // Load environment variables from project
  useEffect(() => {
    if (project?.environmentVariables) {
      setEnvVars(project.environmentVariables);
    }
  }, [project]);

  const handleSave = async () => {
    if (!projectId) return;

    // Combine existing vars and new vars (filter out empty new vars)
    const validNewVars = newVars.filter((v) => v.key && v.value);
    const varsToSave = [...envVars, ...validNewVars];

    setIsSaving(true);
    try {
      await updateEnvironmentVariables({
        projectId: projectId as Id<"projects">,
        environmentVariables: varsToSave,
      });
      toast.success("Environment variables updated successfully");
      // Reset new vars state
      setNewVars([]);
    } catch (error) {
      console.error("Failed to update environment variables:", error);
      toast.error("Failed to update environment variables");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNew = () => {
    setNewVars([...newVars, { key: "", value: "" }]);
  };

  const handleRemoveNew = (index: number) => {
    setNewVars(newVars.filter((_, i) => i !== index));
  };

  const handleUpdateNewKey = (index: number, key: string) => {
    const updated = [...newVars];
    updated[index].key = key;
    setNewVars(updated);
  };

  const handleUpdateNewValue = (index: number, value: string) => {
    const updated = [...newVars];
    updated[index].value = value;
    setNewVars(updated);
  };

  const handleDelete = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleUpdateKey = (index: number, newKey: string) => {
    const updated = [...envVars];
    updated[index].key = newKey;
    setEnvVars(updated);
  };

  const handleUpdateValue = (index: number, newValue: string) => {
    const updated = [...envVars];
    updated[index].value = newValue;
    setEnvVars(updated);
  };

  if (project === undefined) {
    // Loading state
    return (
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (project === null) {
    // Project not found
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>
            Manage environment variables for your project. These will be
            injected into your development environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* List of environment variables */}
          <div className="space-y-2">
            {envVars.length === 0 && newVars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <h3 className="text-sm font-medium mb-1">
                  No environment variables
                </h3>
                <p className="text-sm text-muted-foreground">
                  Get started by adding your first environment variable.
                </p>
              </div>
            ) : (
              <>
                {/* Existing variables */}
                {envVars.map((envVar, index) => (
                  <div
                    key={`existing-${index}`}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={envVar.key}
                      onChange={(e) => handleUpdateKey(index, e.target.value)}
                      placeholder="Key"
                      className="flex-1 font-mono text-sm"
                    />
                    <Input
                      value={envVar.value}
                      onChange={(e) => handleUpdateValue(index, e.target.value)}
                      placeholder="Value"
                      type="password"
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {/* New variables being added */}
                {newVars.map((newVar, index) => (
                  <div key={`new-${index}`} className="flex items-center gap-2">
                    <Input
                      placeholder="Key"
                      value={newVar.key}
                      onChange={(e) =>
                        handleUpdateNewKey(index, e.target.value)
                      }
                      className="flex-1 font-mono text-sm"
                      autoFocus={index === newVars.length - 1}
                    />
                    <Input
                      placeholder="Value"
                      type="password"
                      value={newVar.value}
                      onChange={(e) =>
                        handleUpdateNewValue(index, e.target.value)
                      }
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveNew(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer with actions - always visible */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button onClick={handleAddNew} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
            <Button onClick={handleSave} loading={isSaving} disabled={isSaving}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
