import React, { useRef, useEffect, useState, KeyboardEvent } from "react";
import { Input } from "../ui/input";
import useSuggestions from "@/hooks/useSuggestions";
import { X } from "lucide-react";

type SearchableInputProps<T> = {
  items: T[];
  query: string;
  setQuery: (val: string) => void;
  keyName: keyof T;
  onSelect: (item: T) => void;
  renderItem?: (item: T) => React.ReactNode;
};

function SearchableInput<T extends { [key: string]: any }>({
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
      setQuery(selected[keyName]);
      setDropdownOpen(false);
      setHighlightIndex(-1);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setHighlightIndex(-1);
    }
  };

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery(item[keyName]);
    setDropdownOpen(false);
    setHighlightIndex(-1);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
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
        />
        {(dropdownOpen || query) && (
          <button
            type="button"
            onClick={() => {
              if (query) {
                setQuery("");
              } else {
                setDropdownOpen(false);
              }
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {dropdownOpen && visibleSuggestions.length > 0 && (
        <ul
          ref={dropdownRef}
          className="absolute z-10 mt-1 w-full bg-background border border-input rounded-md shadow-sm max-h-60 overflow-auto"
        >
          {visibleSuggestions.map((suggestion, index) => {
            const isHighlighted = index === highlightIndex;
            return (
              <li
                key={index}
                className={`px-3 py-2 text-sm text-foreground cursor-pointer ${
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
