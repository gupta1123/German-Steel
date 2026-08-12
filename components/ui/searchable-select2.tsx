"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type SearchableOption<T = unknown> = {
  value: string;
  label: string;
  data?: T;
};

interface SearchableSelectProps<T = unknown> {
  options: SearchableOption<T>[];
  value?: string;
  onSelect: (option: SearchableOption<T> | null) => void;
  placeholder?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  disabled?: boolean;
  allowClear?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  loadingMessage?: string;
  onOpenChange?: (open: boolean) => void;
}

export function SearchableSelect<T = unknown>({
  options,
  value,
  onSelect,
  placeholder = "Select an option",
  emptyMessage = "No options available",
  noResultsMessage = "No results found",
  disabled = false,
  allowClear = false,
  triggerClassName,
  contentClassName,
  searchPlaceholder = "Search...",
  loading = false,
  loadingMessage = "Loading...",
  onOpenChange,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    const search = query.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(search));
  }, [options, query]);

  const selectedOption = value ? options.find((option) => option.value === value) : undefined;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setQuery("");
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  const handleSelect = (option: SearchableOption<T>) => {
    onSelect(option);
    handleOpenChange(false);
  };

  const handleClear = () => {
    onSelect(null);
    handleOpenChange(false);
  };

  const hasOptions = options.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[280px] justify-between",
            !selectedOption && "text-muted-foreground",
            triggerClassName,
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[280px] p-2", contentClassName)} align="start">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingMessage}
          </div>
        ) : hasOptions ? (
          <>
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9"
            />
            {allowClear && selectedOption && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start text-muted-foreground"
                onClick={handleClear}
              >
                <X className="mr-2 h-4 w-4" />
                Clear selection
              </Button>
            )}
            <ScrollArea className="mt-2 max-h-64">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">{noResultsMessage}</div>
              ) : (
                <div className="space-y-1">
                  {filteredOptions.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(option)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected && "bg-muted",
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                        {isSelected && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default SearchableSelect;


