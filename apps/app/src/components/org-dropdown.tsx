import * as React from "react";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
  const navigate = useNavigate();
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
      <PopoverContent align="start" className="w-52 p-0">
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
                    src={`https://github.com/${org.slug}.png?s=40`}
                    alt={org.name}
                    className="mr-1 size-5 rounded"
                  />
                  {org.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  navigate("/new-account");
                }}
              >
                <PlusIcon className="mr-1 size-4" />
                New Account
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
