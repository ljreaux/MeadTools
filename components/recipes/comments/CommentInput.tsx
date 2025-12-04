"use client";

import { useRef, useState, useEffect } from "react";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Link2,
  Code,
  List,
  ListOrdered,
  Quote,
  FileText,
  Pencil,
  Send,
  EyeOff
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { MarkdownPreview } from "./MarkdownPreview";

type Props = {
  isLoggedIn: boolean;
  text: string;
  setText: (s: string) => void;
  submit: () => void;
  maxChars?: number;
  submitLabel?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
};

export default function CommentInputGroup({
  isLoggedIn,
  text,
  setText,
  submit,
  maxChars = 2000,
  submitLabel = "Post",
  onCancel,
  autoFocus = false
}: Props) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");

  // Focus handling for write mode
  useEffect(() => {
    if (mode === "write" && autoFocus && taRef.current) {
      taRef.current.focus();
    }
  }, [mode, autoFocus]);

  if (!isLoggedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        Log in to leave a comment.
      </p>
    );
  }

  // --- selection helpers ---
  const sel = () => {
    const ta = taRef.current!;
    return {
      start: ta.selectionStart ?? 0,
      end: ta.selectionEnd ?? 0,
      value: text
    };
  };

  const setSel = (s: number, e: number) =>
    requestAnimationFrame(() => taRef.current?.setSelectionRange(s, e));

  const replace = (start: number, end: number, insert: string) => {
    const before = text.slice(0, start);
    const after = text.slice(end);
    const next = before + insert + after;
    setText(next);
    return { start: before.length, end: before.length + insert.length };
  };

  const wrap = (pre: string, post = pre, placeholder = "text") => {
    const { start, end, value } = sel();
    const picked = value.slice(start, end) || placeholder;
    const { start: a, end: b } = replace(start, end, `${pre}${picked}${post}`);
    setSel(a + pre.length, b - post.length);
  };

  const code = () => {
    const { start, end, value } = sel();
    const picked = value.slice(start, end);
    if (picked.includes("\n")) {
      const { start: a } = replace(
        start,
        end,
        "```\n" + (picked || "code") + "\n```"
      );
      setSel(a + 4, a + 4 + (picked ? picked.length : 4));
    } else {
      wrap("`");
    }
  };

  const link = () => {
    const { start, end, value } = sel();
    const picked = value.slice(start, end) || "link text";
    const { start: a } = replace(start, end, `[${picked}](https://)`);
    setSel(a + picked.length + 3, a + picked.length + 3 + 8);
  };

  const listify = (ordered = false) => {
    const { start, end, value } = sel();
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;
    const lines = value.slice(lineStart, blockEnd).split("\n");
    const out = lines
      .map((l, i) =>
        ordered ? `${i + 1}. ${l || "item"}` : `- ${l || "item"}`
      )
      .join("\n");
    const { start: a, end: b } = replace(lineStart, blockEnd, out);
    setSel(a, b);
  };

  const quote = () => {
    const { start, end, value } = sel();
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;
    const out = value
      .slice(lineStart, blockEnd)
      .split("\n")
      .map((l) => (l.startsWith("> ") ? l : `> ${l || "quote"}`))
      .join("\n");
    const { start: a, end: b } = replace(lineStart, blockEnd, out);
    setSel(a, b);
  };

  const spoiler = () => {
    // discord-style: ||spoiler||
    wrap("||", "||", "spoiler");
  };

  const count = text.length;
  const over = count > maxChars;
  const near = count >= maxChars * 0.9;

  // keyboard shortcuts (⌘/Ctrl + B/I/K)
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    const hasMod = e.metaKey || e.ctrlKey;

    // Submit on Cmd/Ctrl + Enter
    if (hasMod && e.key === "Enter") {
      e.preventDefault();
      if (!text.trim() || count > maxChars) return;
      submit();
      return;
    }

    if (!hasMod) return;
    if (e.key === "b") {
      e.preventDefault();
      wrap("**");
    } else if (e.key === "i") {
      e.preventDefault();
      wrap("*");
    } else if (e.key === "k") {
      e.preventDefault();
      link();
    }
  };

  return (
    <InputGroup>
      {mode === "write" ? (
        <InputGroupTextarea
          ref={taRef}
          rows={5}
          placeholder="Write a comment in Markdown…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[120px] bg-transparent focus-visible:ring-0"
          aria-invalid={over}
          aria-describedby="comment-count"
        />
      ) : (
        <MarkdownPreview text={text} className="w-full p-3" minHeight={120} />
      )}

      <InputGroupAddon align="block-end" className="gap-1">
        {/* Preview/Edit toggle */}
        {mode === "preview" ? (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            aria-label="Edit"
            onClick={() => setMode("write")}
          >
            <Pencil className="h-4 w-4" />
          </InputGroupButton>
        ) : (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            aria-label="Preview"
            onClick={() => setMode("preview")}
          >
            <FileText className="h-4 w-4" />
          </InputGroupButton>
        )}

        <Separator
          orientation="vertical"
          className="!h-4 mx-1 sm:flex hidden"
        />

        {/* Formatting toolbar (Write mode only, ≥ sm) */}
        {mode === "write" && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  className="sm:flex hidden"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Bold"
                  onClick={() => wrap("**")}
                >
                  <Bold className="h-4 w-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Bold (Ctrl/⌘ + B)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  className="sm:flex hidden"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Italic"
                  onClick={() => wrap("*")}
                >
                  <Italic className="h-4 w-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Italic (Ctrl/⌘ + I)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  className="sm:flex hidden"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Quote"
                  onClick={quote}
                >
                  <Quote className="h-4 w-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Blockquote</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  className="sm:flex hidden"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Ordered list"
                  onClick={() => listify(true)}
                >
                  <ListOrdered className="h-4 w-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Numbered list</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  className="sm:flex hidden"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Bulleted list"
                  onClick={() => listify(false)}
                >
                  <List className="h-4 w-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Bulleted list</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  className="sm:flex hidden"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Link"
                  onClick={link}
                >
                  <Link2 className="h-4 w-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Link (Ctrl/⌘ + K)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  className="sm:flex hidden"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Code"
                  onClick={code}
                >
                  <Code className="h-4 w-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Code / Code block</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton
                  className="sm:flex hidden"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Spoiler"
                  onClick={spoiler}
                >
                  <EyeOff className="h-4 w-4" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent>Spoiler</TooltipContent>
            </Tooltip>
          </>
        )}

        <div className="ml-auto" />

        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-3 mr-1 text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}

        {mode === "write" && (
          <InputGroupText
            id="comment-count"
            className={`text-xs tabular-nums mr-2 ${
              over
                ? "text-destructive"
                : near
                  ? "text-warning"
                  : "text-muted-foreground"
            }`}
          >
            {count}/{maxChars}
          </InputGroupText>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton
              size="icon-xs"
              variant="default"
              className="rounded-full"
              aria-label={submitLabel}
              onClick={submit}
              disabled={!text.trim() || over}
            >
              <Send className="h-4 w-4" />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>{submitLabel} (⌘/Ctrl + Enter)</TooltipContent>
        </Tooltip>
      </InputGroupAddon>
    </InputGroup>
  );
}
