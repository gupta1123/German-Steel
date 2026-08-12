"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: string;
  // If this number changes, the dropdown will open (used for external triggers)
  openOnSignal?: number;
  // Hide the internal trigger button entirely (use with anchorRef + openOnSignal)
  hideTrigger?: boolean;
  // Use an external element as the anchor for positioning the dropdown
  anchorRef?: React.RefObject<HTMLElement | null>;
  onSearchChange?: (searchTerm: string) => void;
  loading?: boolean;
  loadingMessage?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
  maxHeight = "200px",
  openOnSignal,
  hideTrigger = false,
  anchorRef,
  onSearchChange,
  loading = false,
  loadingMessage = "Loading...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !value.includes(option.value)
  );

  // Handle click outside to close dropdown (robust against portals)
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      const path = (event.composedPath && event.composedPath()) || [];

      // Don't close if clicking inside the component or its portal
      if (
        (dropdownRef.current && dropdownRef.current.contains(target)) ||
        (portalRef.current && portalRef.current.contains(target)) ||
        (triggerRef.current && triggerRef.current.contains(target))
      ) {
        return;
      }

      // Don't close if clicking inside a dialog
      if (target.closest('[data-radix-dialog-content]')) {
        return;
      }

      setIsOpen(false);
      setSearchTerm("");
      setFocusedIndex(-1);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      const anchorEl = (anchorRef?.current as HTMLElement | null) || triggerRef.current;
      const dialogContent = anchorEl?.closest('[data-radix-dialog-content]') as HTMLElement | null;
      if (dialogContent) {
        setPortalContainer(dialogContent);
      } else {
        const radixPortal = anchorEl?.closest('[data-radix-portal]') as HTMLElement | null ||
          (document.querySelector('[data-radix-portal]') as HTMLElement | null);
        setPortalContainer(radixPortal ?? document.body);
      }
    } else if (!isOpen) {
      setPortalContainer(null);
    }

    if (isOpen) {
      const anchorEl = (anchorRef?.current as HTMLElement | null) || triggerRef.current;
      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    }

    if (!isOpen) {
      return;
    }

    const handleScroll = () => {
      const anchorEl = (anchorRef?.current as HTMLElement | null) || triggerRef.current;
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen]);

  // Open dropdown when parent triggers a new signal
  useEffect(() => {
    if (typeof openOnSignal === 'number' && !disabled) {
      setIsOpen(true);
    }
  }, [openOnSignal, disabled]);

  // Focus search input when dropdown opens and reset state when closing
  useEffect(() => {
    if (isOpen) {
      const raf = window.requestAnimationFrame(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus({ preventScroll: true });
          searchInputRef.current.select();
        }
      });

      return () => window.cancelAnimationFrame(raf);
    }

    setSearchTerm("");
    setFocusedIndex(-1);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !onSearchChange) return;

    const timeoutId = window.setTimeout(() => {
      onSearchChange(searchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, searchTerm, onSearchChange]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter": {
        // If focus is in the search input, do not close; only select when list item is focused
        const active = document.activeElement as HTMLElement | null;
        const isInSearch = active && searchInputRef.current && searchInputRef.current === active;
        if (!isInSearch) {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[focusedIndex].value);
          }
        }
        break;
      }
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        setFocusedIndex(-1);
        break;
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange([...value, optionValue]);
    setSearchTerm("");
    setFocusedIndex(-1);
  };

  const handleRemove = (optionValue: string) => {
    onChange(value.filter(v => v !== optionValue));
  };

  const getSelectedLabels = () => {
    return value.map(v => options.find(opt => opt.value === v)?.label).filter(Boolean);
  };

  const selectedLabels = getSelectedLabels();

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Trigger Button (optional) */}
      {!hideTrigger && (
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            "flex items-center justify-between w-full px-3 py-2 text-sm border border-input bg-background rounded-md",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isOpen && "ring-2 ring-ring ring-offset-2"
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedLabels.length > 0 ? (
              selectedLabels.map((label, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-xs rounded"
                >
                  {label}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    const option = options.find(opt => opt.label === label);
                    if (option) handleRemove(option.value);
                  }}
                  aria-label="Remove"
                  className="hover:bg-primary-foreground/20 rounded-full p-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </span>
                </span>
              ))
            ) : (
              placeholder ? <span className="text-muted-foreground">{placeholder}</span> : null
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
        </button>
      )}

      {/* Dropdown Portal */}
      {isOpen && typeof window !== 'undefined' && portalContainer && createPortal(
        <div 
          className="fixed bg-popover border border-border rounded-md shadow-lg"
          style={{ 
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 99999
          }}
          ref={(node) => {
            portalRef.current = node;
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border" onKeyDown={(e) => e.stopPropagation()}>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setFocusedIndex(-1);
                }}
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Options List */}
          <div 
            className="overflow-y-auto"
            style={{ maxHeight }}
          >
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                {loadingMessage}
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground",
                    "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                    "flex items-center justify-between",
                    index === focusedIndex && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span>{option.label}</span>
                  <Check className="h-4 w-4 opacity-0" />
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                {searchTerm ? "No options found" : "No options available"}
              </div>
            )}
          </div>
        </div>,
        portalContainer
      )}
    </div>
  );
};

export default SearchableSelect;
