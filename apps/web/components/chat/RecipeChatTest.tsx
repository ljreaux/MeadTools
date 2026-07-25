"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import Header from "@/components/account/header";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message as ChatMessageRow,
  MessageContent as ChatMessageContent,
  MessageFooter
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport
} from "@/components/ui/message-scroller";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { useToast } from "@/hooks/use-toast";
import { useCreateRecipeMutation } from "@/hooks/reactQuery/useRecipeQuery";
import { isRecipeData } from "@/types/recipeData";
import {
  formatChatSessionMarkdown,
  type ChatSessionMessage
} from "@/lib/ai/chat-export";
import type { ChatTurnEvent } from "@/lib/ai/chat-service";
import type { BuildRecipeDraftInput } from "@meadtools/recipe-workflows";
import type { RecipeDataV2 } from "@meadtools/schemas";
import {
  fetchServerSentEvents,
  type UIMessage as TanStackUIMessage,
  useChat
} from "@tanstack/ai-react";
import {
  CircleAlert,
  Copy,
  CopyCheck,
  Download,
  LoaderCircle,
  Save,
  Send,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type ChatMessage = ChatSessionMessage & {
  id: string;
};

type ChatTurnUsage = {
  provider: "fireworks";
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  requestIds: string[];
  toolCalls: number;
  latencyMs: number;
};

type ChatTurnResult = {
  answer: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
  recipeDraftInput?: BuildRecipeDraftInput;
  usage: ChatTurnUsage;
};

type ToolActivity = {
  id: string;
  name: string;
  status: "running" | "ok" | "error";
};

type RecipeChatProps = {
  compact?: boolean;
  onClose?: () => void;
};

export default function RecipeChatTest({
  compact = false,
  onClose
}: RecipeChatProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const token = useAuthToken();
  const { status: authStatus } = useSession();
  const canUseChat = Boolean(token) || authStatus === "authenticated";
  const [input, setInput] = useState("");
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([]);
  const [activeRecipeData, setActiveRecipeData] = useState<RecipeDataV2>();
  const [recipeDraftInput, setRecipeDraftInput] = useState<BuildRecipeDraftInput>();
  const [model, setModel] = useState<string>();
  const [error, setError] = useState<string>();
  const [turnResults, setTurnResults] = useState<Record<string, ChatTurnResult>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedDraftName, setSavedDraftName] = useState("");
  const [saveAsPrivate, setSaveAsPrivate] = useState(true);
  const copyResetTimeoutRef = useRef<number | undefined>(undefined);
  const tokenRef = useRef<string | null>(null);
  const activeRecipeDataRef = useRef<RecipeDataV2 | undefined>(undefined);
  const recipeDraftInputRef = useRef<BuildRecipeDraftInput | undefined>(undefined);
  const createRecipeMutation = useCreateRecipeMutation();

  tokenRef.current = token;
  activeRecipeDataRef.current = activeRecipeData;
  recipeDraftInputRef.current = recipeDraftInput;

  const connection = useMemo(
    () =>
      fetchServerSentEvents("/api/chat/recipe", () => ({
        ...(tokenRef.current
          ? { headers: { Authorization: `Bearer ${tokenRef.current}` } }
          : {}),
        body: {
          ...(activeRecipeDataRef.current
            ? { activeRecipeData: activeRecipeDataRef.current }
            : {}),
          ...(recipeDraftInputRef.current
            ? { recipeDraftInput: recipeDraftInputRef.current }
            : {})
        }
      })),
    []
  );

  const {
    messages: tanStackMessages,
    sendMessage,
    stop,
    isLoading: isSubmitting
  } = useChat({
    connection,
    queue: "drop",
    onCustomEvent: (eventType, data) => {
      if (eventType === "recipe.tool" && isChatTurnEvent(data)) {
        applyToolEvent(data, setToolActivity);
        return;
      }
      if (eventType !== "recipe.turn" || !isRecord(data)) return;
      const messageId = data.messageId;
      const result = data.result;
      if (typeof messageId !== "string" || !isChatTurnResult(result)) return;
      const draft = recipeDataFrom(result.toolResults);
      if (draft) setActiveRecipeData(draft);
      if (result.recipeDraftInput) setRecipeDraftInput(result.recipeDraftInput);
      setModel(result.usage.model);
      setTurnResults((current) => ({ ...current, [messageId]: result }));
    },
    onError: () => setError(t("chatbotTest.errors.requestFailed")),
    onFinish: () => setToolActivity([])
  });

  const messages = useMemo(
    () => displayMessagesFromTanStack(tanStackMessages, turnResults),
    [tanStackMessages, turnResults]
  );

  const latestUsage = useMemo(
    () => [...messages].reverse().find((message) => message.usage)?.usage,
    [messages]
  );

  async function submitMessage() {
    const content = input.trim();
    if (!content || isSubmitting) return;

    if (!canUseChat) {
      setError(t("chatbotTest.errors.noToken"));
      return;
    }

    setInput("");
    setError(undefined);
    setToolActivity([]);
    try {
      await sendMessage(content);
    } catch {
      setError(t("chatbotTest.errors.requestFailed"));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  function cancelRequest() {
    stop();
    setToolActivity([]);
  }

  function openSaveDraft() {
    setSavedDraftName(recipeDraftInput?.name?.trim() || t("chatbotTest.untitledDraft"));
    setSaveDialogOpen(true);
  }

  async function saveDraft() {
    if (!activeRecipeData || !isRecipeData(activeRecipeData)) {
      toast({
        title: t("errorLabel"),
        description: t("chatbotTest.errors.saveFailed"),
        variant: "destructive"
      });
      return;
    }
    const name = savedDraftName.trim();
    if (!name) {
      toast({
        title: t("errorLabel"),
        description: t("nameRequired"),
        variant: "destructive"
      });
      return;
    }

    try {
      await createRecipeMutation.mutateAsync({
        name,
        dataV2: activeRecipeData,
        private: saveAsPrivate,
        activityEmailsEnabled: false
      });
      toast({ description: t("chatbotTest.saveDraftSuccess") });
      setSaveDialogOpen(false);
      router.push("/account");
    } catch {
      toast({
        title: t("errorLabel"),
        description: t("chatbotTest.errors.saveFailed"),
        variant: "destructive"
      });
    }
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      if (copyResetTimeoutRef.current !== undefined) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(
        () => setCopiedMessageId(undefined),
        1_500
      );
    } catch {
      setError(t("chatbotTest.errors.copyFailed"));
    }
  }

  function exportSession() {
    const exportedAt = new Date();
    const file = new Blob(
      [
        formatChatSessionMarkdown({
          messages,
          exportedAt,
          model
        })
      ],
      { type: "text/markdown;charset=utf-8" }
    );
    const downloadUrl = URL.createObjectURL(file);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `meadtools-chat-session-${exportedAt
      .toISOString()
      .replace(/[:.]/g, "-")}.md`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  }

  return (
    <main
      className={
        compact
          ? "flex h-[min(40rem,calc(100vh-6rem))] w-full flex-col rounded-xl bg-card p-3"
          : "w-11/12 max-w-5xl rounded-xl bg-background p-6 sm:p-10"
      }
    >
      {compact ? (
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h2 className="text-base font-semibold">{t("chatbotPopup.title")}</h2>
          <div className="flex items-center gap-1">
            <Button
              aria-label={t("chatbotTest.saveDraft")}
              disabled={!activeRecipeData}
              onClick={openSaveDraft}
              size="icon-xs"
              title={t("chatbotTest.saveDraft")}
              type="button"
              variant="ghost"
            >
              <Save />
            </Button>
            <Button
              aria-label={t("chatbotPopup.close")}
              onClick={onClose}
              size="icon-xs"
              title={t("chatbotPopup.close")}
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Header />
          <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl">{t("chatbotTest.title")}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {t("chatbotTest.description")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                {activeRecipeData
                  ? t("chatbotTest.activeDraft")
                  : t("chatbotTest.noActiveDraft")}
              </div>
              <Button
                disabled={!activeRecipeData}
                onClick={openSaveDraft}
                size="sm"
                type="button"
                variant="outline"
              >
                <Save />
                {t("chatbotTest.saveDraft")}
              </Button>
            </div>
          </div>
        </>
      )}

      <Card className={compact ? "flex min-h-0 flex-1 overflow-hidden" : "mt-6 overflow-hidden"}>
        <CardContent className={compact ? "flex min-h-0 flex-1 flex-col p-3" : "p-4 sm:p-6"}>
          <MessageScrollerProvider autoScroll scrollPreviousItemPeek={48}>
            <MessageScroller
              className={
                compact
                  ? "min-h-0 flex-1 rounded-lg border bg-secondary p-2"
                  : "h-[55vh] min-h-[18rem] rounded-lg border bg-secondary p-2"
              }
            >
              <MessageScrollerViewport>
                <MessageScrollerContent
                  aria-busy={isSubmitting}
                  className="px-1 py-1"
                >
                  {messages.length === 0 ? (
                    <MessageScrollerItem messageId="empty-chat">
                      <div className="flex min-h-[16rem] items-center justify-center text-center text-sm text-muted-foreground">
                        {t("chatbotTest.emptyState")}
                      </div>
                    </MessageScrollerItem>
                  ) : (
                    messages.map((message) => (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={message.role === "user"}
                      >
                        <ChatMessageRow align={message.role === "user" ? "end" : "start"}>
                          <ChatMessageContent>
                            <Bubble
                              align={message.role === "user" ? "end" : "start"}
                              className="group/bubble"
                              variant="outline"
                            >
                              <BubbleContent className="pr-10">
                                <MessageResponse>{message.content}</MessageResponse>
                              </BubbleContent>
                              <Button
                                aria-label={
                                  copiedMessageId === message.id
                                    ? t("chatbotTest.copiedMessage")
                                    : t("chatbotTest.copyMessage")
                                }
                                className="absolute right-1 top-1 opacity-0 transition-opacity group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 focus-visible:opacity-100"
                                onClick={() => void copyMessage(message)}
                                size="icon-xs"
                                title={
                                  copiedMessageId === message.id
                                    ? t("chatbotTest.copiedMessage")
                                    : t("chatbotTest.copyMessage")
                                }
                                type="button"
                                variant="ghost"
                              >
                                {copiedMessageId === message.id ? <CopyCheck /> : <Copy />}
                              </Button>
                            </Bubble>
                            {!compact && message.tools && message.tools.length > 0 ? (
                              <MessageFooter>
                                <span>{t("chatbotTest.toolsUsed")}</span>
                              </MessageFooter>
                            ) : null}
                          </ChatMessageContent>
                        </ChatMessageRow>
                      </MessageScrollerItem>
                    ))
                  )}

                  {isSubmitting ? (
                    <MessageScrollerItem messageId="recipe-research-status">
                      <ToolActivityMarker tools={toolActivity} t={t} />
                    </MessageScrollerItem>
                  ) : null}

                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>

          <form className={compact ? "mt-3 space-y-3" : "mt-5 space-y-3"} onSubmit={onSubmit}>
            <Textarea
              aria-label={t("chatbotTest.inputLabel")}
              disabled={isSubmitting}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={onInputKeyDown}
              placeholder={t("chatbotTest.placeholder")}
              value={input}
            />
            <div className="flex items-center justify-between gap-3">
              {!compact ? (
                <p className="text-xs text-muted-foreground">
                  {t("chatbotTest.localOnly")}
                </p>
              ) : <span />}
              {isSubmitting ? (
                <Button onClick={cancelRequest} type="button" variant="outline">
                  <X />
                  {t("chatbotTest.stop")}
                </Button>
              ) : (
                <Button disabled={!input.trim() || !canUseChat} type="submit">
                  <Send />
                  {t("chatbotTest.send")}
                </Button>
              )}
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {!compact ? (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
            <CardTitle className="text-base">{t("chatbotTest.metering")}</CardTitle>
            <Button
              disabled={messages.length === 0}
              onClick={exportSession}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download />
              {t("chatbotTest.exportSession")}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
            <Meter label={t("chatbotTest.model")} value={model ?? "—"} />
            <Meter
              label={t("chatbotTest.tokens")}
              value={latestUsage ? String(latestUsage.totalTokens) : "—"}
            />
            <Meter
              label={t("chatbotTest.latency")}
              value={latestUsage ? `${latestUsage.latencyMs} ms` : "—"}
            />
            <Meter
              label={t("chatbotTest.inputTokens")}
              value={latestUsage ? String(latestUsage.inputTokens) : "—"}
            />
            <Meter
              label={t("chatbotTest.outputTokens")}
              value={latestUsage ? String(latestUsage.outputTokens) : "—"}
            />
            <Meter
              label={t("chatbotTest.cachedTokens")}
              value={latestUsage ? String(latestUsage.cachedInputTokens) : "—"}
            />
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chatbotTest.saveDraft")}</DialogTitle>
            <DialogDescription>{t("chatbotTest.saveDraftDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="grid gap-2 text-sm font-medium">
              {t("chatbotTest.saveDraftName")}
              <Input
                autoFocus
                onChange={(event) => setSavedDraftName(event.currentTarget.value)}
                value={savedDraftName}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              {t("private")}
              <Switch checked={saveAsPrivate} onCheckedChange={setSaveAsPrivate} />
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={!savedDraftName.trim() || createRecipeMutation.isPending}
              onClick={() => void saveDraft()}
              type="button"
            >
              <Save />
              {createRecipeMutation.isPending
                ? t("saving")
                : t("chatbotTest.saveDraft")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-medium">{value}</p>
    </div>
  );
}

function ToolActivityMarker({
  tools,
  t
}: {
  tools: ToolActivity[];
  t: (key: string) => string;
}) {
  const hasError = tools.some((tool) => tool.status === "error");
  const isChecking = tools.length === 0 || tools.some((tool) => tool.status === "running");
  const message = hasError
    ? t("chatbotTest.toolActivityError")
    : isChecking
      ? t("chatbotTest.toolActivityRunning")
      : t("chatbotTest.toolActivityWriting");

  return (
    <Bubble align="start" variant="outline">
      <BubbleContent className="px-3 py-2">
        <Marker
          className={hasError ? "text-destructive" : "text-foreground"}
          role="status"
        >
          {hasError ? (
            <CircleAlert />
          ) : (
            <LoaderCircle className="animate-spin" />
          )}
          <MarkerContent className={hasError ? undefined : "shimmer"}>
            {message}
          </MarkerContent>
        </Marker>
      </BubbleContent>
    </Bubble>
  );
}

function displayMessagesFromTanStack(
  messages: TanStackUIMessage[],
  turnResults: Record<string, ChatTurnResult>
): ChatMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = message.parts
      .flatMap((part) => (part.type === "text" ? [part.content] : []))
      .join("\n")
      .trim();
    if (!content) return [];
    const result = turnResults[message.id];
    return [{
      id: message.id,
      role: message.role,
      content,
      ...(result
        ? {
            tools: result.toolResults.map(({ toolName }) => toolName),
            usage: result.usage
          }
        : {})
    }];
  });
}

function isChatTurnEvent(value: unknown): value is ChatTurnEvent {
  return (
    isRecord(value) &&
    (value.type === "tool_call" || value.type === "tool_result") &&
    typeof value.toolName === "string" &&
    (value.type !== "tool_result" || typeof value.status === "string")
  );
}

function applyToolEvent(
  event: ChatTurnEvent,
  setToolActivity: (action: (current: ToolActivity[]) => ToolActivity[]) => void
) {
  if (event.type === "tool_call") {
    setToolActivity((current) => [
      ...current,
      { id: crypto.randomUUID(), name: event.toolName, status: "running" }
    ]);
    return;
  }
  setToolActivity((current) => markToolComplete(current, event.toolName, event.status));
}

function markToolComplete(
  tools: ToolActivity[],
  toolName: string,
  status: unknown
): ToolActivity[] {
  const nextStatus: ToolActivity["status"] = status === "ok" ? "ok" : "error";
  const toolIndex = tools.map((tool) => tool.name).lastIndexOf(toolName);
  if (toolIndex === -1) return tools;

  return tools.map((tool, index) =>
    index === toolIndex ? { ...tool, status: nextStatus } : tool
  );
}

function isChatTurnResult(value: unknown): value is ChatTurnResult {
  return (
    isRecord(value) &&
    typeof value.answer === "string" &&
    Array.isArray(value.toolResults) &&
    isRecord(value.usage) &&
    typeof value.usage.model === "string" &&
    typeof value.usage.totalTokens === "number"
  );
}

function recipeDataFrom(
  toolResults: ChatTurnResult["toolResults"]
): RecipeDataV2 | undefined {
  for (const toolResult of [...toolResults].reverse()) {
    if (!isRecord(toolResult.result) || toolResult.result.status !== "ok") continue;
    const workflow = toolResult.result.result;
    if (
      isRecord(workflow) &&
      workflow.status === "recipe" &&
      isRecord(workflow.recipeData)
    ) {
      return workflow.recipeData as RecipeDataV2;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
