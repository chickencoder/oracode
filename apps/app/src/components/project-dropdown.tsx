import * as React from "react";
import { ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "@repo/convex/_generated/dataModel";

interface Project {
  _id: Id<"projects">;
  name: string;
  description: string;
}

interface ProjectDropdownProps {
  projects: Project[];
  value?: Id<"projects">;
  onSelect?: (projectId: Id<"projects">) => void;
  className?: string;
  isLoading?: boolean;
}

export function ProjectDropdown({
  projects,
  value,
  onSelect,
  className,
  isLoading = false,
}: ProjectDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState(value ?? "");

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === selectedValue ? "" : currentValue;
    setSelectedValue(newValue as Id<"projects">);
    setOpen(false);
    onSelect?.(newValue as Id<"projects">);
  };

  const selectedProject = projects.find(
    (project) => project._id === selectedValue,
  );

  if (isLoading || !selectedProject) {
    return <Skeleton className={cn("h-6 w-6", className)} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          role="combobox"
          aria-expanded={open}
          className={cn("h-6 w-6 p-0", className)}
        >
          <ChevronsUpDownIcon className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project._id}
                  value={project._id}
                  onSelect={handleSelect}
                >
                  <span>{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
