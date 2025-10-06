"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
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
import { useRepositories } from "@/hooks/useRepositories";

interface RepositoryDropdownProps {
  value?: number;
  onValueChange?: (value: number) => void;
  disabled?: boolean;
}

export function RepositoryDropdown({
  value,
  onValueChange,
  disabled = false,
}: RepositoryDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const { repos, loading, error } = useRepositories(!disabled);

  const selectedRepo = repos?.find((repo) => repo.id === value);

  if (loading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedRepo ? (
            <span className="truncate">{selectedRepo.name}</span>
          ) : (
            "Select repository..."
          )}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command>
          <CommandInput placeholder="Search repositories..." />
          <CommandList>
            <CommandEmpty>
              {error ? error : "No repositories found."}
            </CommandEmpty>
            <CommandGroup>
              {repos?.map((repo) => (
                <CommandItem
                  key={repo.id}
                  value={repo.fullName}
                  onSelect={() => {
                    onValueChange?.(repo.id);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === repo.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{repo.name}</span>
                    {repo.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {repo.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
