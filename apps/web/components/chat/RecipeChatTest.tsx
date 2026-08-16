"use client";

import { MessageResponse } from "@/components/ai-elements/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message as ChatMessageRow,
  MessageContent as ChatMessageContent,
  MessageFooter,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import SearchableInput from "@/components/ui/SearchableInput";
import Header from "@/components/account/header";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { useAuth } from "@/hooks/auth/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCreateBrewEntry } from "@/hooks/reactQuery/useCreateBrewEntry";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";
import { useCreateRecipeMutation } from "@/hooks/reactQuery/useRecipeQuery";
import { useCreditAccount } from "@/hooks/reactQuery/useCreditAccount";
import { qk } from "@/lib/db/queryKeys";
import { cn } from "@/lib/utils";
import { isRecipeData } from "@/types/recipeData";
import {
  formatChatSessionMarkdown,
  type ChatSessionMessage,
} from "@/lib/ai/chat-export";
import type { ChatTurnEvent } from "@/lib/ai/chat-service";
import {
  buildRecipeDraftInputSchema,
  type BuildRecipeDraftInput,
} from "@meadtools/recipe-workflows";
import {
  CHAT_TURN_CREDIT_WARNING_CREDITS,
  CHAT_TURN_PREAUTHORIZATION_CREDITS,
} from "@meadtools/chat-domain";
import type { RecipeDataV2 } from "@meadtools/schemas";
import type { BrewActionProposal } from "@meadtools/brew-domain/action-proposal";
import {
  fetchServerSentEvents,
  type UIMessage as TanStackUIMessage,
  useChat,
} from "@tanstack/ai-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  CircleAlert,
  Copy,
  CopyCheck,
  Download,
  ExternalLink,
  LoaderCircle,
  Maximize2,
  Minimize2,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import Fuse from "fuse.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

type ChatMessage = ChatSessionMessage & {
  id: string;
  status?: PersistedChatMessage["status"];
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
  conversationTitle?: string;
  usage: ChatTurnUsage;
};

type ToolActivity = {
  id: string;
  name: string;
  status: "running" | "ok" | "error";
};

type ChatContextOption =
  | { kind: "recipe"; id: number; name: string }
  | {
      kind: "brew";
      id: string;
      name: string;
      stage: string;
      recipeName: string | null;
    };

type ChatContextSelection = Pick<ChatContextOption, "kind" | "id">;

type ChatConversation = {
  id: string;
  title: string;
  state: "active" | "archived";
  messageCount: number;
  lastActivityAt: string;
};

type ChatHistoryStatusFilter = "all" | "active" | "archived";

type PersistedChatMessage = {
  id: string;
  role: "user" | "assistant";
  status: "pending" | "complete" | "failed" | "cancelled";
  content: string;
};

type ChatThreadResponse = {
  conversation: ChatConversation;
  messages: PersistedChatMessage[];
  nextBeforeSequence: number | null;
  latestDraft: {
    recipeDraftInput: unknown;
    recipeData: unknown;
  } | null;
};

type RecipeChatProps = {
  compact?: boolean;
  fullscreen?: boolean;
  onClose?: () => void;
  onToggleFullscreen?: () => void;
  embedded?: boolean;
};

export default function RecipeChatTest({
  compact = false,
  fullscreen = false,
  onClose,
  onToggleFullscreen,
  embedded = false,
}: RecipeChatProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = useAuthToken();
  const { status: authStatus } = useSession();
  const canUseChat = Boolean(token) || authStatus === "authenticated";
  const showEvaluatorDetails = user?.role === "admin";
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationSummary, setActiveConversationSummary] =
    useState<ChatConversation>();
  const [conversationNextBefore, setConversationNextBefore] = useState<
    string | null
  >(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<ChatHistoryStatusFilter>("all");
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] =
    useState(false);
  const [threadNextBeforeSequence, setThreadNextBeforeSequence] = useState<
    number | null
  >(null);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [threadAtCapacity, setThreadAtCapacity] = useState(false);
  const [renamingConversation, setRenamingConversation] =
    useState<ChatConversation>();
  const [conversationTitleInput, setConversationTitleInput] = useState("");
  const [deletingConversation, setDeletingConversation] =
    useState<ChatConversation>();
  const [isUpdatingConversation, setIsUpdatingConversation] = useState(false);
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([]);
  const [activeRecipeData, setActiveRecipeData] = useState<RecipeDataV2>();
  const [recipeDraftInput, setRecipeDraftInput] =
    useState<BuildRecipeDraftInput>();
  const [contextOptions, setContextOptions] = useState<ChatContextOption[]>([]);
  const [selectedAccountContext, setSelectedAccountContext] =
    useState<ChatContextSelection>();
  const [contextQuery, setContextQuery] = useState("");
  const [isLoadingContextOptions, setIsLoadingContextOptions] = useState(false);
  const [contextOptionsError, setContextOptionsError] = useState<string>();
  const [model, setModel] = useState<string>();
  const [error, setError] = useState<string>();
  const [insufficientCredits, setInsufficientCredits] = useState<{
    availableCredits?: number;
    requiredCredits?: number;
  }>();
  const [turnResults, setTurnResults] = useState<
    Record<string, ChatTurnResult>
  >({});
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedDraftName, setSavedDraftName] = useState("");
  const [saveAsPrivate, setSaveAsPrivate] = useState(true);
  const [confirmedBrewActions, setConfirmedBrewActions] = useState<Set<string>>(
    () => new Set(),
  );
  const copyResetTimeoutRef = useRef<number | undefined>(undefined);
  const tokenRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const clientMessageIdRef = useRef<string | undefined>(undefined);
  const threadAtCapacityRef = useRef(false);
  const insufficientCreditsRef = useRef<
    | {
        availableCredits?: number;
        requiredCredits?: number;
      }
    | undefined
  >(undefined);
  const capacityToastShownRef = useRef(false);
  const tanStackMessagesRef = useRef<TanStackUIMessage[]>([]);
  const activeRecipeDataRef = useRef<RecipeDataV2 | undefined>(undefined);
  const recipeDraftInputRef = useRef<BuildRecipeDraftInput | undefined>(
    undefined,
  );
  const selectedAccountContextRef = useRef<ChatContextSelection | undefined>(
    undefined,
  );
  const createRecipeMutation = useCreateRecipeMutation();
  const createBrewEntryMutation = useCreateBrewEntry();
  const creditAccount = useCreditAccount();
  const availableCredits = creditAccount.data?.availableCredits;
  const creditBalanceBelowPreauthorization =
    typeof availableCredits === "number" &&
    availableCredits < CHAT_TURN_PREAUTHORIZATION_CREDITS;
  const creditBalanceIsNegative = (availableCredits ?? 0) < 0;
  const [persistedMessageStatuses, setPersistedMessageStatuses] = useState<
    Record<string, PersistedChatMessage["status"]>
  >({});

  tokenRef.current = token;
  conversationIdRef.current = conversationId;
  activeRecipeDataRef.current = activeRecipeData;
  recipeDraftInputRef.current = recipeDraftInput;
  selectedAccountContextRef.current = selectedAccountContext;

  useEffect(() => {
    if (!canUseChat) return;
    let cancelled = false;
    setIsLoadingContextOptions(true);
    setContextOptionsError(undefined);
    void fetch("/api/chat/context", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          contexts?: ChatContextOption[];
          error?: string;
        } | null;
        if (!response.ok || !payload?.contexts) {
          throw new Error(payload?.error || "Unable to load chat context.");
        }
        if (!cancelled) setContextOptions(payload.contexts);
      })
      .catch(() => {
        if (!cancelled)
          setContextOptionsError(t("chatbotTest.errors.contextFailed"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContextOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canUseChat, t, token]);

  const connection = useMemo(
    () =>
      fetchServerSentEvents("/api/chat/recipe", () => ({
        ...(tokenRef.current
          ? { headers: { Authorization: `Bearer ${tokenRef.current}` } }
          : {}),
        fetchClient: async (...args) => {
          const response = await fetch(...args);
          if (response.status === 409) {
            const payload = (await response
              .clone()
              .json()
              .catch(() => null)) as {
              error?: string;
            } | null;
            threadAtCapacityRef.current = Boolean(
              payload?.error?.includes("reached its message or content limit"),
            );
          }
          if (response.status === 402) {
            insufficientCreditsRef.current = (await response
              .clone()
              .json()
              .catch(() => null)) as
              | {
                  availableCredits?: number;
                  requiredCredits?: number;
                }
              | undefined;
          }
          return response;
        },
        body: {
          ...(conversationIdRef.current
            ? { conversationId: conversationIdRef.current }
            : {}),
          ...(clientMessageIdRef.current
            ? { clientMessageId: clientMessageIdRef.current }
            : {}),
          ...(activeRecipeDataRef.current
            ? { activeRecipeData: activeRecipeDataRef.current }
            : {}),
          ...(recipeDraftInputRef.current
            ? { recipeDraftInput: recipeDraftInputRef.current }
            : {}),
          ...(selectedAccountContextRef.current
            ? { selectedAccountContext: selectedAccountContextRef.current }
            : {}),
        },
      })),
    [],
  );

  const {
    messages: tanStackMessages,
    sendMessage,
    setMessages,
    stop,
    isLoading: isSubmitting,
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
      const conversationTitle = result.conversationTitle;
      if (conversationTitle) {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationIdRef.current
              ? { ...conversation, title: conversationTitle }
              : conversation,
          ),
        );
        setActiveConversationSummary((current) => {
          if (!current || current.id !== conversationIdRef.current)
            return current;
          return { ...current, title: conversationTitle };
        });
      }
      setModel(result.usage.model);
      setTurnResults((current) => ({ ...current, [messageId]: result }));
    },
    onError: () => {
      if (threadAtCapacityRef.current) {
        showThreadCapacity();
        return;
      }
      if (insufficientCreditsRef.current) {
        const credits = insufficientCreditsRef.current;
        setInsufficientCredits(credits);
        const creditError = creditErrorMessage(credits, t);
        setError(creditError);
        toast({
          title: t("chatbotTest.insufficientCredits"),
          description: creditError,
          variant: "destructive",
        });
        return;
      }
      setError(t("chatbotTest.errors.requestFailed"));
    },
    onFinish: () => {
      setToolActivity([]);
      void queryClient.invalidateQueries({ queryKey: qk.creditAccount });
    },
  });
  tanStackMessagesRef.current = tanStackMessages;

  function showThreadCapacity() {
    setThreadAtCapacity(true);
    setError(t("chatbotTest.errors.threadCapacity"));
    if (capacityToastShownRef.current) return;
    capacityToastShownRef.current = true;
    toast({
      title: t("chatbotTest.chatLimitReached"),
      description: t("chatbotTest.errors.threadCapacity"),
      variant: "destructive",
    });
  }

  async function loadChatThread(id: string) {
    setIsLoadingThread(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/chat/conversations/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = (await response.json().catch(() => null)) as
        | ChatThreadResponse
        | {
            error?: string;
          }
        | null;
      if (!response.ok || !payload || !("conversation" in payload)) {
        throw new Error("Unable to load chat thread.");
      }
      const recipeData = payload.latestDraft?.recipeData;
      const draftInput = buildRecipeDraftInputSchema.safeParse(
        payload.latestDraft?.recipeDraftInput,
      );
      conversationIdRef.current = payload.conversation.id;
      setConversationId(payload.conversation.id);
      setActiveConversationSummary(payload.conversation);
      setConversations((current) => {
        const exists = current.some(
          (conversation) => conversation.id === payload.conversation.id,
        );
        if (!exists) return [payload.conversation, ...current];
        return current.map((conversation) =>
          conversation.id === payload.conversation.id
            ? payload.conversation
            : conversation,
        );
      });
      setMessages(persistedMessagesToTanStack(payload.messages));
      setPersistedMessageStatuses(
        statusesFromPersistedMessages(payload.messages),
      );
      setThreadNextBeforeSequence(payload.nextBeforeSequence);
      setThreadAtCapacity(false);
      threadAtCapacityRef.current = false;
      capacityToastShownRef.current = false;
      setTurnResults({});
      setModel(undefined);
      setActiveRecipeData(isRecipeData(recipeData) ? recipeData : undefined);
      setRecipeDraftInput(draftInput.success ? draftInput.data : undefined);
    } catch {
      setError(t("chatbotTest.errors.threadFailed"));
    } finally {
      setIsLoadingThread(false);
    }
  }

  async function loadRecentConversations(options?: {
    append?: boolean;
    before?: string;
    query?: string;
    state?: Exclude<ChatHistoryStatusFilter, "all">;
  }) {
    const searchParams = new URLSearchParams({ limit: "20" });
    if (options?.before) searchParams.set("before", options.before);
    if (options?.query) searchParams.set("query", options.query);
    if (options?.state) searchParams.set("state", options.state);
    const response = await fetch(`/api/chat/conversations?${searchParams}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const payload = (await response.json().catch(() => null)) as {
      conversations?: ChatConversation[];
      nextBefore?: string | null;
    } | null;
    if (!response.ok || !payload?.conversations) {
      throw new Error("Unable to load chat conversations.");
    }
    setConversations((current) => {
      if (!options?.append) return payload.conversations!;
      const existing = new Set(current.map((conversation) => conversation.id));
      return [
        ...current,
        ...payload.conversations!.filter(
          (conversation) => !existing.has(conversation.id),
        ),
      ];
    });
    setConversationNextBefore(payload.nextBefore ?? null);
    return payload.conversations;
  }

  async function loadOlderMessages() {
    if (!conversationId || !threadNextBeforeSequence || isLoadingOlderMessages)
      return;
    setIsLoadingOlderMessages(true);
    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}?beforeSequence=${threadNextBeforeSequence}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as ChatThreadResponse | null;
      if (!response.ok || !payload)
        throw new Error("Unable to load older chat messages.");
      setMessages([
        ...persistedMessagesToTanStack(payload.messages),
        ...tanStackMessagesRef.current,
      ]);
      setPersistedMessageStatuses((current) => ({
        ...current,
        ...statusesFromPersistedMessages(payload.messages),
      }));
      setThreadNextBeforeSequence(payload.nextBeforeSequence);
    } catch {
      setError(t("chatbotTest.errors.threadFailed"));
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }

  async function ensureConversation(): Promise<string> {
    if (conversationIdRef.current) return conversationIdRef.current;
    const response = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
    const payload = (await response.json().catch(() => null)) as {
      conversation?: ChatConversation;
    } | null;
    if (!response.ok || !payload?.conversation) {
      throw new Error("Unable to create chat conversation.");
    }
    conversationIdRef.current = payload.conversation.id;
    setConversationId(payload.conversation.id);
    setActiveConversationSummary(payload.conversation);
    setConversations((current) => [payload.conversation!, ...current]);
    return payload.conversation.id;
  }

  function startNewConversation() {
    if (isSubmitting) return;
    conversationIdRef.current = undefined;
    setConversationId(undefined);
    setActiveConversationSummary(undefined);
    setMessages([]);
    setPersistedMessageStatuses({});
    setTurnResults({});
    setActiveRecipeData(undefined);
    setRecipeDraftInput(undefined);
    setModel(undefined);
    setError(undefined);
    setInput("");
    setSelectedAccountContext(undefined);
    setContextQuery("");
    setHistoryQuery("");
    setThreadNextBeforeSequence(null);
    setThreadAtCapacity(false);
    threadAtCapacityRef.current = false;
    capacityToastShownRef.current = false;
  }

  function selectConversation(id: string) {
    setHistoryOpen(false);
    void loadChatThread(id);
  }

  function startNewConversationFromHistory() {
    setHistoryOpen(false);
    startNewConversation();
  }

  async function loadMoreConversations() {
    if (!conversationNextBefore || isLoadingMoreConversations) return;
    setIsLoadingMoreConversations(true);
    try {
      await loadRecentConversations({
        append: true,
        before: conversationNextBefore,
        ...(historyQuery.trim() ? { query: historyQuery.trim() } : {}),
        ...(historyStatusFilter === "all"
          ? {}
          : { state: historyStatusFilter }),
      });
    } catch {
      setError(t("chatbotTest.errors.threadFailed"));
    } finally {
      setIsLoadingMoreConversations(false);
    }
  }

  async function updateConversation(
    target: ChatConversation,
    update: { title?: string; state?: "active" | "archived" },
  ) {
    setIsUpdatingConversation(true);
    try {
      const response = await fetch(`/api/chat/conversations/${target.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(update),
      });
      const payload = (await response.json().catch(() => null)) as {
        conversation?: ChatConversation;
      } | null;
      if (!response.ok || !payload?.conversation) {
        throw new Error("Unable to update chat conversation.");
      }
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === target.id ? payload.conversation! : conversation,
        ),
      );
      if (target.id === conversationId) {
        setActiveConversationSummary(payload.conversation);
      }
      if (
        target.id === conversationId &&
        payload.conversation.state === "archived"
      ) {
        startNewConversation();
        setHistoryOpen(false);
      }
      setRenamingConversation(undefined);
    } catch {
      setError(t("chatbotTest.errors.threadUpdateFailed"));
    } finally {
      setIsUpdatingConversation(false);
    }
  }

  async function deleteConversation(target: ChatConversation) {
    setIsUpdatingConversation(true);
    try {
      const response = await fetch(`/api/chat/conversations/${target.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error("Unable to delete chat conversation.");
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== target.id),
      );
      if (target.id === conversationId) {
        startNewConversation();
        setHistoryOpen(false);
      }
      setDeletingConversation(undefined);
    } catch {
      setError(t("chatbotTest.errors.threadDeleteFailed"));
    } finally {
      setIsUpdatingConversation(false);
    }
  }

  function openRenameConversation(target: ChatConversation) {
    setConversationTitleInput(target.title);
    setRenamingConversation(target);
  }

  useEffect(() => {
    if (!canUseChat) return;
    let cancelled = false;
    void loadRecentConversations()
      .then((recent) => {
        if (!cancelled && recent[0]) void loadChatThread(recent[0].id);
      })
      .catch(() => {
        if (!cancelled) setError(t("chatbotTest.errors.threadFailed"));
      });
    return () => {
      cancelled = true;
    };
    // `token` may refresh while this evaluator is open; reload only on a real identity change.
  }, [canUseChat, token]);

  useEffect(() => {
    if (!canUseChat || !historyOpen) return;
    const timeout = window.setTimeout(() => {
      void loadRecentConversations({
        ...(historyQuery.trim() ? { query: historyQuery.trim() } : {}),
        ...(historyStatusFilter === "all"
          ? {}
          : { state: historyStatusFilter }),
      }).catch(() => setError(t("chatbotTest.errors.threadFailed")));
    }, 200);
    return () => window.clearTimeout(timeout);
    // Search is intentionally server-backed so conversations outside the loaded page remain findable.
  }, [canUseChat, historyOpen, historyQuery, historyStatusFilter, token]);

  const messages = useMemo(
    () =>
      displayMessagesFromTanStack(
        tanStackMessages,
        turnResults,
        t("additionalLinks.wiki"),
        persistedMessageStatuses,
      ),
    [persistedMessageStatuses, tanStackMessages, t, turnResults],
  );

  const latestUsage = useMemo(
    () => [...messages].reverse().find((message) => message.usage)?.usage,
    [messages],
  );
  const popupLayout = compact || fullscreen;
  const activeConversation =
    activeConversationSummary?.id === conversationId
      ? activeConversationSummary
      : conversations.find(
          (conversation) => conversation.id === conversationId,
        );
  const activeConversationTitle =
    activeConversation?.title ?? t("chatbotTest.newChat");
  const activeConversationArchived = activeConversation?.state === "archived";

  async function submitMessage() {
    const content = input.trim();
    if (!content || isSubmitting) return;

    if (!canUseChat) {
      setError(t("chatbotTest.errors.noToken"));
      return;
    }
    if (creditBalanceBelowPreauthorization) {
      const credits = { availableCredits };
      setInsufficientCredits(credits);
      setError(creditErrorMessage(credits, t));
      return;
    }

    setInput("");
    setError(undefined);
    setInsufficientCredits(undefined);
    insufficientCreditsRef.current = undefined;
    setThreadAtCapacity(false);
    threadAtCapacityRef.current = false;
    capacityToastShownRef.current = false;
    setToolActivity([]);
    try {
      await ensureConversation();
      clientMessageIdRef.current = crypto.randomUUID();
      await sendMessage(content);
      clientMessageIdRef.current = undefined;
      void loadRecentConversations().catch(() => undefined);
    } catch {
      clientMessageIdRef.current = undefined;
      if (threadAtCapacityRef.current) {
        showThreadCapacity();
      } else if (insufficientCreditsRef.current) {
        const credits = insufficientCreditsRef.current;
        setInsufficientCredits(credits);
        setError(creditErrorMessage(credits, t));
      } else {
        setError(t("chatbotTest.errors.requestFailed"));
      }
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

  function selectAccountContext(value: string) {
    const option = contextOptions.find(
      (candidate) => contextOptionValue(candidate) === value,
    );
    if (!option) return;
    setSelectedAccountContext({ kind: option.kind, id: option.id });
    setContextQuery(contextOptionValue(option));
  }

  function setContextSearchQuery(value: string) {
    setContextQuery(value);
    if (
      !selectedAccountContext ||
      value !== contextSelectionValue(selectedAccountContext)
    ) {
      setSelectedAccountContext(undefined);
    }
  }

  function openSaveDraft() {
    setSavedDraftName(
      recipeDraftInput?.name?.trim() || t("chatbotTest.untitledDraft"),
    );
    setSaveDialogOpen(true);
  }

  async function saveDraft() {
    if (!activeRecipeData || !isRecipeData(activeRecipeData)) {
      toast({
        title: t("errorLabel"),
        description: t("chatbotTest.errors.saveFailed"),
        variant: "destructive",
      });
      return;
    }
    const name = savedDraftName.trim();
    if (!name) {
      toast({
        title: t("errorLabel"),
        description: t("nameRequired"),
        variant: "destructive",
      });
      return;
    }

    try {
      await createRecipeMutation.mutateAsync({
        name,
        dataV2: activeRecipeData,
        private: saveAsPrivate,
        activityEmailsEnabled: false,
      });
      toast({ description: t("chatbotTest.saveDraftSuccess") });
      setSaveDialogOpen(false);
      router.push("/account");
    } catch {
      toast({
        title: t("errorLabel"),
        description: t("chatbotTest.errors.saveFailed"),
        variant: "destructive",
      });
    }
  }

  async function confirmBrewAction(
    actionId: string,
    proposal: BrewActionProposal,
  ) {
    try {
      await createBrewEntryMutation.mutateAsync({
        brewId: proposal.target.brewId,
        input: brewActionEntryInput(proposal),
      });
      setConfirmedBrewActions((current) => new Set(current).add(actionId));
      toast({ description: t("chatbotTest.brewActionSaved") });
    } catch {
      toast({
        title: t("errorLabel"),
        description: t("chatbotTest.errors.brewActionFailed"),
        variant: "destructive",
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
        1_500,
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
          model,
        }),
      ],
      { type: "text/markdown;charset=utf-8" },
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
        fullscreen
          ? "fixed inset-0 z-[1002] flex h-[100dvh] min-h-0 w-screen flex-col bg-background p-4 pt-24 sm:p-6 sm:pt-24"
          : compact
            ? "flex h-[min(40rem,calc(100vh-6rem))] w-full min-w-0 flex-col rounded-xl bg-card p-3"
            : embedded
              ? "w-full"
              : "relative mx-auto mt-24 mb-24 w-11/12 max-w-5xl rounded-xl bg-background p-6 pt-16 sm:p-10 sm:pt-20"
      }
    >
      {!compact && !fullscreen ? <Header /> : null}
      {popupLayout ? (
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h2
            className="min-w-0 flex-1 truncate text-base font-semibold"
            title={activeConversationTitle}
          >
            {activeConversationTitle}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              aria-label={
                historyOpen
                  ? t("chatbotTest.backToChat")
                  : t("chatbotTest.chatHistory")
              }
              disabled={isSubmitting || isLoadingThread}
              onClick={() => setHistoryOpen((open) => !open)}
              size="icon-xs"
              title={
                historyOpen
                  ? t("chatbotTest.backToChat")
                  : t("chatbotTest.chatHistory")
              }
              type="button"
              variant="ghost"
            >
              <MessageSquareText />
            </Button>
            <Button
              aria-label={t("chatbotTest.newChat")}
              disabled={isSubmitting}
              onClick={startNewConversation}
              size="icon-xs"
              title={t("chatbotTest.newChat")}
              type="button"
              variant="ghost"
            >
              <Plus />
            </Button>
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
            {compact ? (
              <Button
                aria-label={t("chatbotPopup.openFullPage")}
                asChild
                size="icon-xs"
                title={t("chatbotPopup.openFullPage")}
                variant="ghost"
              >
                <Link href="/account/chat" scroll>
                  <ExternalLink />
                </Link>
              </Button>
            ) : null}
            <Button
              aria-label={
                fullscreen
                  ? t("chatbotPopup.collapse")
                  : t("chatbotPopup.expand")
              }
              onClick={onToggleFullscreen}
              size="icon-xs"
              title={
                fullscreen
                  ? t("chatbotPopup.collapse")
                  : t("chatbotPopup.expand")
              }
              type="button"
              variant="ghost"
            >
              {fullscreen ? <Minimize2 /> : <Maximize2 />}
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl">{t("chatbotTest.title")}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {t("chatbotTest.description")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                disabled={!activeRecipeData}
                onClick={openSaveDraft}
                size="icon"
                title={t("chatbotTest.saveDraft")}
                type="button"
                variant="outline"
              >
                <Save />
              </Button>
            </div>
          </div>
        </>
      )}

      <Card
        className={
          popupLayout
            ? "flex min-h-0 min-w-0 max-w-full flex-1 overflow-hidden"
            : "mt-6 overflow-hidden"
        }
      >
        <CardContent
          className={
            popupLayout
              ? "flex min-h-0 min-w-0 max-w-full flex-1 flex-col p-3"
              : "p-4 sm:p-6"
          }
        >
          {historyOpen ? (
            <ChatHistoryPanel
              activeConversationId={conversationId}
              activeConversationTitle={activeConversationTitle}
              conversations={conversations}
              disabled={isSubmitting || isLoadingThread}
              hasMore={Boolean(conversationNextBefore)}
              isLoadingMore={isLoadingMoreConversations}
              onClose={() => setHistoryOpen(false)}
              onDelete={(conversation) => setDeletingConversation(conversation)}
              onLoadMore={() => void loadMoreConversations()}
              onNew={startNewConversationFromHistory}
              onRename={openRenameConversation}
              onSelect={selectConversation}
              onToggleArchived={(conversation) =>
                void updateConversation(conversation, {
                  state:
                    conversation.state === "active" ? "archived" : "active",
                })
              }
              popupLayout={popupLayout}
              query={historyQuery}
              statusFilter={historyStatusFilter}
              setQuery={setHistoryQuery}
              setStatusFilter={setHistoryStatusFilter}
              t={t}
            />
          ) : (
            <>
              {!popupLayout ? (
                <ChatThreadHeader
                  disabled={isSubmitting || isLoadingThread}
                  onHistory={() => setHistoryOpen((open) => !open)}
                  onNew={startNewConversation}
                  title={activeConversationTitle}
                  t={t}
                />
              ) : null}
              <MessageScrollerProvider autoScroll scrollPreviousItemPeek={48}>
                <MessageScroller
                  className={
                    popupLayout
                      ? "min-h-0 flex-1 rounded-lg border bg-secondary p-2"
                      : "h-[55vh] min-h-[18rem] rounded-lg border bg-secondary p-2"
                  }
                >
                  <MessageScrollerViewport>
                    <MessageScrollerContent
                      aria-busy={isSubmitting}
                      className="px-1 py-1"
                    >
                      {threadNextBeforeSequence ? (
                        <MessageScrollerItem messageId="load-older-messages">
                          <div className="flex justify-center pb-3">
                            <Button
                              disabled={isLoadingOlderMessages}
                              onClick={() => void loadOlderMessages()}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              {isLoadingOlderMessages
                                ? t("chatbotTest.loadingOlderMessages")
                                : t("chatbotTest.loadOlderMessages")}
                            </Button>
                          </div>
                        </MessageScrollerItem>
                      ) : null}
                      {messages.length === 0 ? (
                        <MessageScrollerItem messageId="empty-chat">
                          <div className="flex min-h-[16rem] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                            <div className="max-w-xl space-y-3">
                              <p className="font-medium text-foreground">
                                {t("chatbotTest.emptyStateTitle")}
                              </p>
                              <p>{t("chatbotTest.emptyState")}</p>
                              <p className="text-xs">
                                {t("chatbotTest.emptyStateContext")}
                              </p>
                            </div>
                          </div>
                        </MessageScrollerItem>
                      ) : (
                        messages.map((message) => {
                          const proposal =
                            message.role === "assistant"
                              ? brewActionProposalFrom(
                                  turnResults[message.id]?.toolResults,
                                )
                              : undefined;
                          return (
                            <MessageScrollerItem
                              key={message.id}
                              messageId={message.id}
                              scrollAnchor={message.role === "user"}
                            >
                              <ChatMessageRow
                                align={
                                  message.role === "user" ? "end" : "start"
                                }
                              >
                                <ChatMessageContent>
                                  <Bubble
                                    align={
                                      message.role === "user" ? "end" : "start"
                                    }
                                    className="group/bubble"
                                    variant="outline"
                                  >
                                    <BubbleContent className="pr-10">
                                      <MessageResponse>
                                        {message.content}
                                      </MessageResponse>
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
                                      {copiedMessageId === message.id ? (
                                        <CopyCheck />
                                      ) : (
                                        <Copy />
                                      )}
                                    </Button>
                                  </Bubble>
                                  {!compact &&
                                  message.tools &&
                                  message.tools.length > 0 ? (
                                    <MessageFooter>
                                      <span>{t("chatbotTest.toolsUsed")}</span>
                                    </MessageFooter>
                                  ) : null}
                                  {message.status === "pending" ? (
                                    <MessageFooter>
                                      <span className="text-muted-foreground">
                                        {t("chatbotTest.pendingMessage")}
                                      </span>
                                    </MessageFooter>
                                  ) : message.status === "failed" ||
                                    message.status === "cancelled" ? (
                                    <MessageFooter>
                                      <span className="text-destructive">
                                        {t("chatbotTest.interruptedMessage")}
                                      </span>
                                    </MessageFooter>
                                  ) : null}
                                  {proposal ? (
                                    <BrewActionProposalCard
                                      confirmed={confirmedBrewActions.has(
                                        message.id,
                                      )}
                                      isConfirming={
                                        createBrewEntryMutation.isPending
                                      }
                                      onConfirm={() =>
                                        void confirmBrewAction(
                                          message.id,
                                          proposal,
                                        )
                                      }
                                      proposal={proposal}
                                    />
                                  ) : null}
                                </ChatMessageContent>
                              </ChatMessageRow>
                            </MessageScrollerItem>
                          );
                        })
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

              {activeConversationArchived ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <p>{t("chatbotTest.archivedChatDescription")}</p>
                  <Button
                    onClick={() => {
                      if (activeConversation) {
                        void updateConversation(activeConversation, {
                          state: "active",
                        });
                      }
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw />
                    {t("chatbotTest.restoreChat")}
                  </Button>
                </div>
              ) : (
                <form
                  className={popupLayout ? "mt-3 space-y-3" : "mt-5 space-y-3"}
                  onSubmit={onSubmit}
                >
                  <details className="rounded-md border bg-muted/20 px-3 py-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      {t("chatbotTest.attachContext")}
                    </summary>
                    <div
                      className={
                        popupLayout
                          ? "mt-3 space-y-2"
                          : "mt-3 grid gap-1.5 sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-center"
                      }
                    >
                      <label>
                        <span className="sr-only">
                          {t("chatbotTest.contextLabel")}
                        </span>
                        <SearchableInput
                          // The picker sits at the bottom of every chat layout.
                          // Always overlay upward so results cannot be clipped by
                          // the transcript card or fall below the viewport.
                          dropdownPlacement="above"
                          dropdownPortal
                          getLabel={contextOptionLabel}
                          getValue={contextOptionValue}
                          items={contextOptions}
                          keyName="name"
                          onSelect={(option) =>
                            selectAccountContext(contextOptionValue(option))
                          }
                          placeholder={
                            isLoadingContextOptions
                              ? t("chatbotTest.contextLoading")
                              : t("chatbotTest.contextPlaceholder")
                          }
                          query={contextQuery}
                          setQuery={setContextSearchQuery}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {contextOptionsError ||
                          t("chatbotTest.contextReadOnly")}
                      </p>
                    </div>
                  </details>
                  <Textarea
                    aria-label={t("chatbotTest.inputLabel")}
                    disabled={isSubmitting}
                    onChange={(event) => setInput(event.currentTarget.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder={t("chatbotTest.placeholder")}
                    value={input}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {!popupLayout ? (
                        <p className="text-xs text-muted-foreground">
                          {t("chatbotTest.localOnly")}
                        </p>
                      ) : null}
                      <ChatCreditBalance
                        availableCredits={availableCredits}
                        insufficient={Boolean(insufficientCredits)}
                        isLoading={creditAccount.isLoading}
                        t={t}
                      />
                    </div>
                    {isSubmitting ? (
                      <Button
                        onClick={cancelRequest}
                        type="button"
                        variant="outline"
                      >
                        <X />
                        {t("chatbotTest.stopStreaming")}
                      </Button>
                    ) : (
                      <Button
                        disabled={
                          !input.trim() ||
                          !canUseChat ||
                          creditBalanceBelowPreauthorization
                        }
                        type="submit"
                      >
                        <Send />
                        {t("chatbotTest.send")}
                      </Button>
                    )}
                  </div>
                </form>
              )}
              {threadAtCapacity ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  <p>{t("chatbotTest.errors.threadCapacity")}</p>
                  <Button
                    onClick={startNewConversation}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus />
                    {t("chatbotTest.newChat")}
                  </Button>
                </div>
              ) : creditBalanceBelowPreauthorization || insufficientCredits ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  <p>
                    {creditBalanceIsNegative
                      ? t("chatbotTest.errors.negativeCreditBalance")
                      : creditBalanceBelowPreauthorization
                        ? t("chatbotTest.errors.belowPreauthorization", {
                            credits: CHAT_TURN_PREAUTHORIZATION_CREDITS,
                          })
                        : error}
                    {typeof (
                      availableCredits ?? insufficientCredits?.availableCredits
                    ) === "number"
                      ? ` ${t("chatbotTest.availableCredits", {
                          credits: (
                            availableCredits ??
                            insufficientCredits?.availableCredits
                          )?.toLocaleString(),
                        })}`
                      : ""}
                  </p>
                  <Button asChild size="sm" type="button" variant="outline">
                    <Link href="/account/credits">
                      {t("chatbotTest.viewCredits")}
                    </Link>
                  </Button>
                </div>
              ) : error ? (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {!popupLayout && showEvaluatorDetails ? (
        <details className="mt-4 rounded-lg border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            {t("chatbotTest.evaluatorDetails")}
          </summary>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 pb-2">
              <p className="text-sm font-medium">{t("chatbotTest.metering")}</p>
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
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
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
                value={
                  latestUsage ? String(latestUsage.cachedInputTokens) : "—"
                }
              />
            </div>
          </div>
        </details>
      ) : null}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chatbotTest.saveDraft")}</DialogTitle>
            <DialogDescription>
              {t("chatbotTest.saveDraftDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="grid gap-2 text-sm font-medium">
              {t("chatbotTest.saveDraftName")}
              <Input
                autoFocus
                onChange={(event) =>
                  setSavedDraftName(event.currentTarget.value)
                }
                value={savedDraftName}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              {t("private")}
              <Switch
                checked={saveAsPrivate}
                onCheckedChange={setSaveAsPrivate}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={
                !savedDraftName.trim() || createRecipeMutation.isPending
              }
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

      <Dialog
        open={Boolean(renamingConversation)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingConversation)
            setRenamingConversation(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chatbotTest.renameChat")}</DialogTitle>
            <DialogDescription>
              {t("chatbotTest.renameChatDescription")}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium">
            {t("chatbotTest.chatTitle")}
            <Input
              autoFocus
              onChange={(event) =>
                setConversationTitleInput(event.currentTarget.value)
              }
              value={conversationTitleInput}
            />
          </label>
          <DialogFooter>
            <Button
              disabled={
                !renamingConversation ||
                !conversationTitleInput.trim() ||
                isUpdatingConversation
              }
              onClick={() => {
                if (!renamingConversation) return;
                void updateConversation(renamingConversation, {
                  title: conversationTitleInput.trim(),
                });
              }}
              type="button"
            >
              {isUpdatingConversation ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingConversation)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingConversation)
            setDeletingConversation(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chatbotTest.deleteChat")}</DialogTitle>
            <DialogDescription>
              {t("chatbotTest.deleteChatDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={isUpdatingConversation}
              onClick={() => setDeletingConversation(undefined)}
              type="button"
              variant="outline"
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={!deletingConversation || isUpdatingConversation}
              onClick={() => {
                if (deletingConversation)
                  void deleteConversation(deletingConversation);
              }}
              type="button"
              variant="destructive"
            >
              <Trash2 />
              {t("chatbotTest.deleteChat")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function contextOptionValue(context: ChatContextOption): string {
  return `${context.kind}:${context.id}`;
}

function contextOptionLabel(context: ChatContextOption): string {
  return `${context.kind === "brew" ? "Brew" : "Recipe"}: ${context.name}`;
}

function contextSelectionValue(context: ChatContextSelection): string {
  return `${context.kind}:${context.id}`;
}

function persistedMessagesToTanStack(
  messages: PersistedChatMessage[],
): TanStackUIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", content: message.content }],
  })) as TanStackUIMessage[];
}

function statusesFromPersistedMessages(
  messages: PersistedChatMessage[],
): Record<string, PersistedChatMessage["status"]> {
  return Object.fromEntries(
    messages.map((message) => [message.id, message.status]),
  );
}

function ChatCreditBalance({
  availableCredits,
  insufficient,
  isLoading,
  t,
}: {
  availableCredits: number | undefined;
  insufficient: boolean;
  isLoading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const label = isLoading
    ? t("credits.available")
    : t("chatbotTest.availableCredits", {
        credits: (availableCredits ?? 0).toLocaleString(),
      });
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-xs",
        !isLoading &&
          (insufficient ||
            (availableCredits ?? 0) < CHAT_TURN_PREAUTHORIZATION_CREDITS)
          ? "text-destructive"
          : !isLoading &&
              (availableCredits ?? 0) <= CHAT_TURN_CREDIT_WARNING_CREDITS
            ? "text-warning"
            : "text-muted-foreground",
      )}
      title={label}
    >
      <WalletCards aria-hidden="true" className="size-3" />
      <span>{isLoading ? "…" : label}</span>
    </p>
  );
}

function creditErrorMessage(
  credits: { availableCredits?: number },
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return typeof credits.availableCredits === "number" &&
    credits.availableCredits < 0
    ? t("chatbotTest.errors.negativeCreditBalance")
    : t("chatbotTest.errors.insufficientCredits");
}

function ChatThreadHeader({
  disabled,
  onHistory,
  onNew,
  title,
  t,
}: {
  disabled: boolean;
  onHistory: () => void;
  onNew: () => void;
  title: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="mb-3 flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {t("chatbotTest.currentChatLabel")}
        </p>
        <p className="truncate text-sm font-medium" title={title}>
          {title}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-label={t("chatbotTest.chatHistory")}
          disabled={disabled}
          onClick={onHistory}
          size="icon-xs"
          title={t("chatbotTest.chatHistory")}
          type="button"
          variant="ghost"
        >
          <MessageSquareText />
        </Button>
        <Button
          aria-label={t("chatbotTest.newChat")}
          disabled={disabled}
          onClick={onNew}
          size="icon-xs"
          title={t("chatbotTest.newChat")}
          type="button"
          variant="ghost"
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function ChatHistoryPanel({
  activeConversationId,
  activeConversationTitle,
  conversations,
  disabled,
  hasMore,
  isLoadingMore,
  onClose,
  onDelete,
  onLoadMore,
  onNew,
  onRename,
  onSelect,
  onToggleArchived,
  popupLayout,
  query,
  statusFilter,
  setQuery,
  setStatusFilter,
  t,
}: {
  activeConversationId: string | undefined;
  activeConversationTitle: string;
  conversations: ChatConversation[];
  disabled: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onClose: () => void;
  onDelete: (conversation: ChatConversation) => void;
  onLoadMore: () => void;
  onNew: () => void;
  onRename: (conversation: ChatConversation) => void;
  onSelect: (id: string) => void;
  onToggleArchived: (conversation: ChatConversation) => void;
  popupLayout: boolean;
  query: string;
  statusFilter: ChatHistoryStatusFilter;
  setQuery: (query: string) => void;
  setStatusFilter: (filter: ChatHistoryStatusFilter) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const matchingConversations = useMemo(() => {
    const byStatus = conversations.filter(
      (conversation) =>
        statusFilter === "all" || conversation.state === statusFilter,
    );
    if (!query.trim()) return byStatus;
    return new Fuse(byStatus, {
      keys: ["title"],
      threshold: 0.4,
      ignoreLocation: true,
    })
      .search(query)
      .map((result) => result.item);
  }, [conversations, query, statusFilter]);

  return (
    <section
      className={
        popupLayout
          ? "flex min-h-0 min-w-0 max-w-full flex-1 flex-col"
          : "flex h-[55vh] min-h-[18rem] flex-col"
      }
    >
      <div className="border-b pb-3">
        <Button
          className="-ml-2"
          onClick={onClose}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeft />
          {t("chatbotTest.backToChat")}
        </Button>
        <div className="mt-2 min-w-0">
          <p className="text-sm font-medium">{t("chatbotTest.chatHistory")}</p>
          <p className="text-xs text-muted-foreground">
            {t("chatbotTest.chatHistoryDescription")}
          </p>
        </div>
      </div>
      <div className="space-y-3 py-3">
        <Button
          className="w-full"
          disabled={disabled}
          onClick={onNew}
          type="button"
        >
          <Plus />
          {t("chatbotTest.newChat")}
        </Button>
        <div
          className={
            popupLayout
              ? "grid min-w-0 max-w-full gap-2"
              : "grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]"
          }
        >
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("chatbotTest.searchChats")}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t("chatbotTest.searchChats")}
              value={query}
            />
            {query ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={t("clear")}
                  onClick={() => setQuery("")}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <Select
            onValueChange={(value) =>
              setStatusFilter(value as ChatHistoryStatusFilter)
            }
            value={statusFilter}
          >
            <SelectTrigger
              aria-label={t("chatbotTest.chatStatus")}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={popupLayout ? "z-[1002]" : undefined}>
              <SelectItem value="all">{t("chatbotTest.allChats")}</SelectItem>
              <SelectItem value="active">
                {t("chatbotTest.activeChats")}
              </SelectItem>
              <SelectItem value="archived">
                {t("chatbotTest.archivedChats")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto rounded-lg border bg-muted/30 p-2">
        {matchingConversations.length > 0 ? (
          <div className="space-y-1">
            {matchingConversations.map((conversation) => {
              const archived = conversation.state === "archived";
              return (
                <div
                  className={
                    "group flex min-w-0 items-center gap-1 rounded-md border p-1 transition-colors " +
                    (conversation.id === activeConversationId
                      ? "border-primary/60 bg-card shadow-sm"
                      : archived
                        ? "border-border bg-muted/50"
                        : "border-border bg-card shadow-xs hover:border-primary/40 hover:bg-card")
                  }
                  key={conversation.id}
                >
                  <Button
                    className="h-auto min-w-0 max-w-full flex-1 justify-start px-3 py-2 text-left"
                    disabled={disabled}
                    onClick={() => onSelect(conversation.id)}
                    type="button"
                    variant="ghost"
                  >
                    <MessageSquareText className="mt-0.5 shrink-0" />
                    <span className="min-w-0 max-w-full flex-1">
                      <span className="block truncate">
                        {conversation.title}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {archived ? `${t("chatbotTest.archivedChat")} · ` : ""}
                        {formatConversationDate(conversation.lastActivityAt)}
                      </span>
                    </span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={t("chatbotTest.chatActions")}
                        className="mr-1 shrink-0 border bg-card shadow-xs"
                        disabled={disabled}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className={popupLayout ? "z-[1002]" : undefined}
                    >
                      <DropdownMenuItem onSelect={() => onRename(conversation)}>
                        <Pencil />
                        {t("chatbotTest.renameChat")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => onToggleArchived(conversation)}
                      >
                        {archived ? <RotateCcw /> : <Archive />}
                        {archived
                          ? t("chatbotTest.restoreChat")
                          : t("chatbotTest.archiveChat")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onDelete(conversation)}
                      >
                        <Trash2 />
                        {t("chatbotTest.deleteChat")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
            {hasMore ? (
              <Button
                className="mt-2 w-full"
                disabled={disabled || isLoadingMore}
                onClick={onLoadMore}
                size="sm"
                type="button"
                variant="ghost"
              >
                {isLoadingMore
                  ? t("chatbotTest.loadingMoreChats")
                  : t("chatbotTest.loadMoreChats")}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            {query.trim()
              ? t("chatbotTest.noChatResults")
              : t("chatbotTest.noChats")}
          </p>
        )}
      </div>
      {activeConversationId ? (
        <p className="pt-3 text-xs text-muted-foreground">
          {t("chatbotTest.currentChat", { title: activeConversationTitle })}
        </p>
      ) : null}
    </section>
  );
}

function formatConversationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-medium">{value}</p>
    </div>
  );
}

function BrewActionProposalCard({
  confirmed,
  isConfirming,
  onConfirm,
  proposal,
}: {
  confirmed: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
  proposal: BrewActionProposal;
}) {
  const { t } = useTranslation();

  return (
    <Card className="mt-2 w-full max-w-xl border-primary/30 bg-card shadow-none">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-sm">
          {t("chatbotTest.brewActionReview")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{proposal.summary}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">{t("chatbotTest.brewActionTarget")}</p>
          <p className="mt-1 text-muted-foreground">
            {proposal.target.brewLabel}
          </p>
        </div>
        <details className="rounded-md border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {t("chatbotTest.brewActionDetails")}
          </summary>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
            {JSON.stringify(proposal.entry, null, 2)}
          </pre>
        </details>
        <Button
          disabled={confirmed || isConfirming}
          onClick={onConfirm}
          size="sm"
          type="button"
        >
          {confirmed
            ? t("chatbotTest.brewActionSaved")
            : isConfirming
              ? t("chatbotTest.brewActionSaving")
              : t("chatbotTest.brewActionConfirm")}
        </Button>
      </CardContent>
    </Card>
  );
}

function ToolActivityMarker({
  tools,
  t,
}: {
  tools: ToolActivity[];
  t: (key: string) => string;
}) {
  const hasError = tools.some((tool) => tool.status === "error");
  const isChecking =
    tools.length === 0 || tools.some((tool) => tool.status === "running");
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
  turnResults: Record<string, ChatTurnResult>,
  wikiLabel: string,
  persistedMessageStatuses: Record<string, PersistedChatMessage["status"]>,
): ChatMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = message.parts
      .flatMap((part) => (part.type === "text" ? [part.content] : []))
      .join("\n")
      .trim();
    if (!content) return [];
    const result = turnResults[message.id];
    return [
      {
        id: message.id,
        role: message.role,
        content:
          message.role === "assistant"
            ? appendFetchedWikiSource(content, result?.toolResults, wikiLabel)
            : content,
        ...(result
          ? {
              tools: result.toolResults.map(({ toolName }) => toolName),
              usage: result.usage,
            }
          : {}),
        ...(persistedMessageStatuses[message.id]
          ? { status: persistedMessageStatuses[message.id] }
          : {}),
      },
    ];
  });
}

/**
 * The source is carried in the structured turn result as well as the model
 * text. Rendering it here makes the citation dependable even if the model
 * ignores its final Markdown-link instruction.
 */
function appendFetchedWikiSource(
  content: string,
  toolResults: ChatTurnResult["toolResults"] | undefined,
  wikiLabel: string,
): string {
  const sourceUrl = fetchedWikiSourceUrl(toolResults);
  if (!sourceUrl || content.includes(sourceUrl)) return content;
  return `${content}\n\n[${wikiLabel}](${sourceUrl})`;
}

function fetchedWikiSourceUrl(
  toolResults: ChatTurnResult["toolResults"] | undefined,
): string | undefined {
  if (!toolResults) return undefined;
  for (const toolResult of [...toolResults].reverse()) {
    if (
      toolResult.toolName !== "fetch_wiki_page" ||
      !isRecord(toolResult.result)
    )
      continue;
    if (
      toolResult.result.status !== "ok" ||
      !isRecord(toolResult.result.result)
    )
      continue;
    const url = toolResult.result.result.url;
    if (
      typeof url === "string" &&
      url.startsWith("https://wiki.meadtools.com/")
    ) {
      return url;
    }
  }
  return undefined;
}

function brewActionProposalFrom(
  toolResults: ChatTurnResult["toolResults"] | undefined,
): BrewActionProposal | undefined {
  if (!toolResults) return undefined;
  for (const toolResult of [...toolResults].reverse()) {
    if (
      toolResult.toolName !== "prepare_brew_action" ||
      !isRecord(toolResult.result)
    )
      continue;
    if (
      toolResult.result.status !== "ok" ||
      !isRecord(toolResult.result.result)
    )
      continue;
    const proposal = toolResult.result.result;
    if (
      proposal.version === 1 &&
      proposal.kind === "create_brew_entry" &&
      isRecord(proposal.target) &&
      typeof proposal.target.brewId === "string" &&
      typeof proposal.target.brewLabel === "string" &&
      typeof proposal.summary === "string" &&
      isRecord(proposal.entry) &&
      typeof proposal.entry.type === "string"
    ) {
      return proposal as BrewActionProposal;
    }
  }
  return undefined;
}

function brewActionEntryInput(
  proposal: BrewActionProposal,
): CreateBrewEntryInput {
  return {
    ...proposal.entry,
    client_entry_id: crypto.randomUUID(),
  } as CreateBrewEntryInput;
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
  setToolActivity: (
    action: (current: ToolActivity[]) => ToolActivity[],
  ) => void,
) {
  if (event.type === "tool_call") {
    setToolActivity((current) => [
      ...current,
      { id: crypto.randomUUID(), name: event.toolName, status: "running" },
    ]);
    return;
  }
  setToolActivity((current) =>
    markToolComplete(current, event.toolName, event.status),
  );
}

function markToolComplete(
  tools: ToolActivity[],
  toolName: string,
  status: unknown,
): ToolActivity[] {
  const nextStatus: ToolActivity["status"] = status === "ok" ? "ok" : "error";
  const toolIndex = tools.map((tool) => tool.name).lastIndexOf(toolName);
  if (toolIndex === -1) return tools;

  return tools.map((tool, index) =>
    index === toolIndex ? { ...tool, status: nextStatus } : tool,
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
  toolResults: ChatTurnResult["toolResults"],
): RecipeDataV2 | undefined {
  for (const toolResult of [...toolResults].reverse()) {
    if (!isRecord(toolResult.result) || toolResult.result.status !== "ok")
      continue;
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
