"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ModeToggle } from "../ui/mode-toggle";

interface Category {
  path: string;
  method: string;
}

export default function ApiNav({
  categories,
}: {
  categories: Record<string, Category[]>;
}) {
  const topLevelLinks = [
    { name: "Overview", href: "#overview" },
    { name: "Errors", href: "#errors" },
  ];

  const [expandedCategories, setExpandedCategories] = useState<{
    [key: string]: boolean;
  }>({});

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <aside className="fixed hidden sm:block top-0 left-0 h-screen w-64 bg-background shadow-md border-r border-border z-50 p-4 overflow-hidden">
      <span className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">MeadTools API</h2>
        <ModeToggle />
      </span>

      <ScrollArea className="h-full">
        <ul className="space-y-2 text-foreground">
          {/* Top-Level Links */}
          {topLevelLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="block px-3 py-1 rounded-md hover:bg-muted"
              >
                {link.name}
              </a>
            </li>
          ))}

          {/* API Categories (Collapsible) */}
          {Object.entries(categories).map(([category, endpoints]) => (
            <li key={category} className="mt-2">
              {/* Category Header (Clickable to Expand/Collapse) */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between text-md font-semibold text-primary py-1 px-3 hover:bg-muted rounded-md"
              >
                {category}
                {expandedCategories[category] ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {/* API Endpoints (Only show if expanded) */}
              {expandedCategories[category] && (
                <ul className="ml-4 mt-1 space-y-1">
                  {endpoints.map(({ path, method }) => {
                    const formattedId = `${method}-${path.replace(/\//g, "-")}`;
                    return (
                      <li key={formattedId}>
                        <a
                          href={`#${formattedId}`}
                          className="block text-sm text-muted-foreground hover:text-foreground"
                        >
                          <span className="font-mono text-xs text-secondary">
                            {method}
                          </span>{" "}
                          {path}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </aside>
  );
}
