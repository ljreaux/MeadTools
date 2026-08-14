"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { memo, useEffect, useState, type ComponentProps, type HTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import {
  Streamdown,
  type StreamdownProps
} from "streamdown";

type ChatRole = "user" | "assistant";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: ChatRole;
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
        className
      )}
      {...props}
    />
  );
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export function MessageContent({
  children,
  className,
  ...props
}: MessageContentProps) {
  return (
    <div
      className={cn(
        "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
        "group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
        "group-[.is-assistant]:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const streamdownPlugins = { cjk, code, math, mermaid };

export type MessageResponseProps = StreamdownProps;

export const MessageResponse = memo(
  ({ className, components, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "w-full min-w-0 max-w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      components={{ ...components, a: ChatMarkdownLink }}
      // ChatMarkdownLink performs the app's internal-route handling and the
      // external-link confirmation itself. Streamdown's default safety layer
      // otherwise rewrites relative calculator URLs to a blocked placeholder.
      linkSafety={{ enabled: false }}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (previous, next) =>
    previous.children === next.children && previous.isAnimating === next.isAnimating
);

MessageResponse.displayName = "MessageResponse";

function ChatMarkdownLink({
  children,
  className,
  href,
  node: _node,
  ...props
}: ComponentProps<"a"> & { node?: unknown }) {
  const [isOpen, setIsOpen] = useState(false);
  const linkClassName = cn(
    "wrap-anywhere font-medium text-primary underline",
    className
  );

  if (!href) return <span className={linkClassName}>{children}</span>;

  if (isInternalMeadToolsPath(href)) {
    return (
      <Link className={linkClassName} href={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <button
        className={cn("appearance-none text-left", linkClassName)}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {children}
      </button>
      <ChatLinkSafetyModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={() => window.open(href, "_blank", "noreferrer")}
        url={href}
      />
    </>
  );
}

function isInternalMeadToolsPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

function ChatLinkSafetyModal({
  isOpen,
  onClose,
  onConfirm,
  url
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  url: string;
}) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // The browser can deny clipboard access; leaving the dialog open lets the
      // user select the URL manually.
    }
  }

  return createPortal(
    <div
      aria-label={t("chatbotTest.openExternalLink")}
      aria-modal="true"
      className="fixed inset-0 z-[2002] flex items-center justify-center bg-background/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="relative flex w-full max-w-md flex-col gap-4 rounded-xl border bg-background p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          aria-label={t("chatbotTest.closeDialog")}
          className="absolute right-4 top-4"
          onClick={onClose}
          size="icon-xs"
          title={t("chatbotTest.closeDialog")}
          type="button"
          variant="ghost"
        >
          <X />
        </Button>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 pr-8 text-lg font-semibold">
            <ExternalLink className="size-5" />
            <span>{t("chatbotTest.openExternalLink")}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("chatbotTest.externalLinkWarning")}
          </p>
        </div>
        <div className="max-h-32 break-all overflow-y-auto rounded-md bg-muted p-3 font-mono text-sm">
          {url}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => void copyLink()} type="button" variant="outline">
            {copied ? <Check /> : <Copy />}
            {copied ? t("chatbotTest.copiedMessage") : t("chatbotTest.copyLink")}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            type="button"
          >
            <ExternalLink />
            {t("chatbotTest.openLink")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
