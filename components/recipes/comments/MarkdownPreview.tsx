"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type MarkdownPreviewProps = {
  text: string;
  className?: string;
  /** Convenience so you can reuse this elsewhere */
  minHeight?: number | string;
};

// Simple Discord-style spoiler component
function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => setRevealed((v) => !v)}
      className={cn(
        "relative inline-flex items-center rounded-sm",
        revealed
          ? "bg-accent-foreground text-background"
          : "bg-secondary text-transparent hover:bg-primary"
      )}
    >
      <span className="absolute inset-[-2px]" />
      <span
        className={cn(
          "transition-[filter,opacity]",
          revealed ? "opacity-100 blur-0" : "opacity-0 blur-sm"
        )}
      >
        {children}
      </span>
    </button>
  );
}

// Helper: walk React nodes and replace `||spoiler||` with <Spoiler>
function renderSpoilerNodes(children: React.ReactNode): React.ReactNode {
  const SPOILER_REGEX = /\|\|([\s\S]+?)\|\|/g;

  // Case 1: plain string
  if (typeof children === "string") {
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const parts: React.ReactNode[] = [];

    while ((match = SPOILER_REGEX.exec(children)) !== null) {
      if (match.index > lastIndex) {
        parts.push(children.slice(lastIndex, match.index));
      }
      parts.push(<Spoiler key={parts.length}>{match[1]}</Spoiler>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex === 0) return children;

    if (lastIndex < children.length) {
      parts.push(children.slice(lastIndex));
    }

    return parts;
  }

  // Case 2: array of nodes, where markers may be split across siblings
  if (Array.isArray(children)) {
    const result: React.ReactNode[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      if (typeof child === "string" && child.trim() === "||") {
        const spoilerChildren: React.ReactNode[] = [];
        let foundClose = false;
        let j = i + 1;

        for (; j < children.length; j++) {
          const next = children[j];
          if (typeof next === "string" && next.trim() === "||") {
            foundClose = true;
            break;
          }
          spoilerChildren.push(renderSpoilerNodes(next));
        }

        if (foundClose) {
          result.push(<Spoiler key={result.length}>{spoilerChildren}</Spoiler>);
          i = j;
          continue;
        }

        result.push(child);
        continue;
      }

      result.push(renderSpoilerNodes(child));
    }

    return result;
  }

  // Case 3: a React element - recurse into its children (except <code>)
  if (React.isValidElement(children) && children.props?.children) {
    if (children.type === "code") {
      return children;
    }

    return React.cloneElement(children, {
      children: renderSpoilerNodes(children.props.children)
    });
  }

  return children;
}

export function MarkdownPreview({
  text,
  className,
  minHeight = 120
}: MarkdownPreviewProps) {
  const { resolvedTheme } = useTheme();

  const components = React.useMemo(
    () => ({
      pre({ children }: { children?: React.ReactNode }) {
        return <>{children}</>;
      },

      code({
        inline,
        className,
        children,
        ...props
      }: {
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
        [key: string]: any;
      }) {
        const match = /language-(\w+)/.exec(className || "");
        const code = String(children ?? "").replace(/\n$/, "");

        if (inline || !match) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }

        return (
          <SyntaxHighlighter
            style={resolvedTheme === "dark" ? oneDark : oneLight}
            language={match[1]}
            PreTag="div"
            wrapLongLines
            customStyle={{
              margin: 0,
              borderRadius: 8,
              fontSize: "0.85rem",
              overflowX: "auto" // <- keep block from pushing container
            }}
            {...props}
          >
            {code}
          </SyntaxHighlighter>
        );
      },

      // Apply spoiler parsing on common text containers
      p({ children }: { children?: React.ReactNode }) {
        return <p>{renderSpoilerNodes(children)}</p>;
      },
      li({ children }: { children?: React.ReactNode }) {
        return <li>{renderSpoilerNodes(children)}</li>;
      },
      span({ children }: { children?: React.ReactNode }) {
        return <span>{renderSpoilerNodes(children)}</span>;
      },
      // optional: table wrapper to prevent table overflow
      table({ children }: { children?: React.ReactNode }) {
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full">{children}</table>
          </div>
        );
      }
    }),
    [resolvedTheme]
  );

  return (
    <div
      className={cn(
        // key bits: max-w-full + overflow-x-auto stop “spilling”
        "prose prose-invert max-w-full w-full p-3 text-left overflow-x-auto",
        className
      )}
      style={{
        minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text || "_Nothing to preview…_"}
      </ReactMarkdown>
    </div>
  );
}
