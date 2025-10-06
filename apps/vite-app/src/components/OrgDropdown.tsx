"use client";

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

interface Org {
  slug: string;
  name: string;
}

interface OrgDropdownProps {
  orgs: Org[];
  value?: string;
  onSelect?: (orgSlug: string) => void;
  className?: string;
  isLoading?: boolean;
}

export function OrgDropdown({
  orgs,
  value,
  onSelect,
  className,
  isLoading = false,
}: OrgDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState(value ?? "");

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === selectedValue ? "" : currentValue;
    setSelectedValue(newValue);
    setOpen(false);
    onSelect?.(newValue);
  };

  const selectedOrg = orgs.find((org) => org.slug === selectedValue);

  if (isLoading || !selectedOrg) {
    return <Skeleton className={cn("h-9 w-52", className)} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-52 justify-between", className)}
        >
          <div className="flex items-center gap-2">
            <img
              src={`https://github.com/${selectedOrg.slug}.png`}
              alt={selectedOrg.name}
              className="h-5 w-5 rounded"
            />
            <span>{selectedOrg.name}</span>
          </div>
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0">
        <Command>
          <CommandInput placeholder="Search accounts..." />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              {orgs.map((org) => (
                <CommandItem
                  key={org.slug}
                  value={org.slug}
                  onSelect={handleSelect}
                >
                  <img
                    src={`https://github.com/${org.slug}.png`}
                    alt={org.name}
                    className="mr-1 size-5 rounded"
                  />
                  {org.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
