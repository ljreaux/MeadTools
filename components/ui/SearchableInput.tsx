import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import useSuggestions from "@/hooks/useSuggestions";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";

type SearchableInputProps<T> = {
  items: T[];
  query: string;
  setQuery: (val: string) => void;
  keyName: keyof T;
  onSelect: (item: T) => void;
  renderItem?: (item: T) => React.ReactNode;
};

function SearchableInput<T extends Record<string, any>>({
  items,
  query,
  setQuery,
  keyName,
  onSelect,
  renderItem
}: SearchableInputProps<T>) {
  const dropdownRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);

  const { suggestions } = useSuggestions(items, query, keyName);
  const visibleSuggestions = query.trim() === "" ? items : suggestions;

  // click-outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
        setHighlightIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || visibleSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < visibleSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : visibleSuggestions.length - 1
      );
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      const selected = visibleSuggestions[highlightIndex];
      onSelect(selected);
      setQuery(String(selected[keyName] ?? ""));
      setDropdownOpen(false);
      setHighlightIndex(-1);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setHighlightIndex(-1);
    }
  };

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery(String(item[keyName] ?? ""));
    setDropdownOpen(false);
    setHighlightIndex(-1);
  };

  const handleClearOrClose = () => {
    if (query) {
      setQuery("");
      setHighlightIndex(-1);
      setDropdownOpen(true); // keep list open but reset
    } else {
      setDropdownOpen(false);
      setHighlightIndex(-1);
    }
  };
  const listboxId = "searchable-input-listbox";
  return (
    <div className="relative">
      <InputGroup className="h-12">
        <InputGroupInput
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDropdownOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={(e) => {
            e.target.select();
            setDropdownOpen(true);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={dropdownOpen}
          aria-controls={dropdownOpen ? listboxId : undefined}
          className="h-full text-lg relative"
        />

        <InputGroupAddon align="inline-end">
          {(dropdownOpen || query) && (
            <InputGroupButton
              type="button"
              size="icon-xs"
              variant="ghost"
              className="rounded-full"
              onClick={handleClearOrClose}
              aria-label={query ? "Clear search" : "Close suggestions"}
            >
              <X className="h-3 w-3" />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>

      {dropdownOpen && visibleSuggestions.length > 0 && (
        <ul
          id={listboxId}
          ref={dropdownRef}
          className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-input bg-background text-sm shadow-sm"
          role="listbox"
        >
          {visibleSuggestions.map((suggestion, index) => {
            const isHighlighted = index === highlightIndex;
            return (
              <li
                key={index}
                role="option"
                aria-selected={isHighlighted}
                className={`cursor-pointer px-3 py-2 text-foreground ${
                  isHighlighted ? "bg-muted" : "hover:bg-muted"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(suggestion);
                }}
              >
                {renderItem
                  ? renderItem(suggestion)
                  : String(suggestion[keyName] ?? "")}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default SearchableInput;
