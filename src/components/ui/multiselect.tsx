"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  className,
  disabled,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  );

  const handleToggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleRemoveOption = (optionValue: string) => {
    onChange(value.filter((v) => v !== optionValue));
  };

  const handleSelectAll = () => {
    onChange(filteredOptions.map((option) => option.value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className={cn(
          "w-full justify-between text-left font-normal h-auto min-h-9 px-3 py-2",
          selectedOptions.length === 0 && "text-muted-foreground",
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <div className="flex flex-wrap gap-1 overflow-hidden">
          {selectedOptions.length === 0 ? (
            <span className="truncate">{placeholder}</span>
          ) : (
            <>
              {selectedOptions.slice(0, 2).map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="text-xs h-5 px-2"
                >
                  {option.label}
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveOption(option.value);
                    }}
                  />
                </Badge>
              ))}
              {selectedOptions.length > 2 && (
                <Badge variant="secondary" className="text-xs h-5 px-2">
                  +{selectedOptions.length - 2} more
                </Badge>
              )}
            </>
          )}
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </Button>

      {isOpen && (
        <div className="absolute top-full z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="p-2 border-b flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSelectAll}
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground text-center">
                No projects found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2 p-2 text-sm cursor-pointer rounded-sm hover:bg-accent",
                    value.includes(option.value) && "bg-accent",
                  )}
                  onClick={() => handleToggleOption(option.value)}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-sm border",
                      value.includes(option.value) &&
                        "bg-primary border-primary text-primary-foreground",
                    )}
                  >
                    {value.includes(option.value) && (
                      <Check className="h-3 w-3" />
                    )}
                  </div>
                  <span className="truncate">{option.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
