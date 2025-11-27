"use client";

import { Fragment, useState } from "react";
import {
  useComments,
  useCommentThread,
  useCreateComment,
  useUpdateComment,
  useDeleteComment
} from "@/hooks/reactQuery/useComments";
import { Button } from "@/components/ui/button";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import CommentInput from "./CommentInput";
import { CommentItem } from "./CommentItem";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/auth/useAuth";

type CommentWithAuthor = {
  id: string;
  recipe_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  parent_id: string | null;
  // roots will have this, replies usually won't
  reply_count?: number;
  author: {
    public_username: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type CommentNode = CommentWithAuthor;

const MAX_DEPTH = 3;

// Reusable row that can render a root or a reply.
// It loads its own replies via useCommentThread and recurses.
type CommentRowProps = {
  recipeId: number;
  comment: CommentNode;
  depth: number;
  isLoggedIn: boolean;
  currentUserId: number | null;
  isAdmin: boolean;
  order: "asc" | "desc";
  // global reply state from parent
  replyingTo: CommentNode | null;
  setReplyingTo: (c: CommentNode | null) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  // mutations
  onCreate: (parentId: string | null, text: string) => void;
  onEdit: (commentId: string, text: string) => void;
  onDelete: (commentId: string) => void;
};

function CommentRow({
  recipeId,
  comment,
  depth,
  isLoggedIn,
  currentUserId,
  isAdmin = false,
  order,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  onCreate,
  onEdit,
  onDelete
}: CommentRowProps) {
  const [showReplies, setShowReplies] = useState(false);

  // Load replies for this comment (works for roots and replies)
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useCommentThread(recipeId, comment.id, 20, order, showReplies);

  const replies = (data?.pages ?? []).flatMap(
    (p: { data: CommentNode[] }) => p.data
  ) as CommentNode[];

  const isReplyTarget = replyingTo?.id === comment.id;
  const canReply = isLoggedIn && depth < MAX_DEPTH;
  const canEdit =
    !!currentUserId &&
    (comment.user_id === currentUserId || isAdmin) &&
    isLoggedIn;

  const handleToggleReply = () => {
    if (!canReply) return;
    if (isReplyTarget) {
      setReplyingTo(null);
      setReplyText("");
    } else {
      setReplyingTo(comment);
      setReplyText("");
    }
  };

  const handleSubmitReply = () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    // close UI immediately
    setReplyingTo(null);
    setReplyText("");
    onCreate(comment.id, trimmed);
  };

  return (
    <div className="space-y-2">
      <CommentItem
        comment={comment}
        canReply={canReply}
        canEdit={canEdit}
        onReply={canReply ? () => handleToggleReply() : undefined}
        onEdit={canEdit ? (newText) => onEdit(comment.id, newText) : undefined}
        onDelete={canEdit ? () => onDelete(comment.id) : undefined}
      >
        {/* Inline reply box for this comment */}
        {isReplyTarget && (
          <div className="mt-2">
            <CommentInput
              isLoggedIn={isLoggedIn}
              text={replyText}
              setText={setReplyText}
              submit={handleSubmitReply}
              submitLabel="Reply"
              onCancel={() => {
                setReplyingTo(null);
                setReplyText("");
              }}
              autoFocus
            />
          </div>
        )}

        {/* Replies toggle */}
        {(comment.reply_count ?? replies.length) > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowReplies((v) => !v)}
            >
              {showReplies ? "Hide replies" : "Show replies"}{" "}
              {comment.reply_count ? `(${comment.reply_count})` : ""}
            </Button>
          </div>
        )}

        {/* Replies list */}
        {showReplies && (
          <div className="mt-2 ml-2 border-l border-border/60 pl-3 space-y-2">
            {isLoading && (
              <p className="text-xs text-muted-foreground">Loading replies…</p>
            )}

            {replies.map((reply) => (
              <CommentRow
                key={reply.id}
                recipeId={recipeId}
                comment={reply}
                depth={depth + 1}
                isLoggedIn={isLoggedIn}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                order={order}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                replyText={replyText}
                setReplyText={setReplyText}
                onCreate={onCreate}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}

            {hasNextPage && (
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading…" : "Load more replies"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CommentItem>
    </div>
  );
}

export default function CommentsSection({ recipeId }: { recipeId: number }) {
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [showComments, setShowComments] = useState(false);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useComments(recipeId, 20, order);

  const createComment = useCreateComment(recipeId);
  const updateComment = useUpdateComment(recipeId);
  const deleteComment = useDeleteComment(recipeId);

  const token = useAuthToken();
  const isLoggedIn = !!token;

  const { user } = useAuth();
  const currentUserId = user ? Number(user.id) : null;
  const isAdmin = user?.role === "admin";

  // Top-level comment text
  const [rootText, setRootText] = useState("");

  // Global reply state (reused by all rows)
  const [replyingTo, setReplyingTo] = useState<CommentNode | null>(null);
  const [replyText, setReplyText] = useState("");

  const roots = (data?.pages ?? []).flatMap(
    (p: { data: CommentNode[] }) => p.data
  ) as CommentNode[];

  const totalCount =
    ((data?.pages?.[0] as any)?.totalCount as number | undefined) ??
    roots.length ??
    0;

  const handlePostRoot = () => {
    const trimmed = rootText.trim();
    if (!trimmed) return;

    createComment.mutate(
      { comment: trimmed, parent_id: null },
      {
        onSuccess: () => {
          setRootText("");
        }
      }
    );
  };

  const handleCreate = (parentId: string | null, text: string) => {
    createComment.mutate({ comment: text, parent_id: parentId ?? null });
  };

  const handleEditComment = (commentId: string, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    updateComment.mutate({ id: commentId, comment: trimmed });
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment.mutate({ id: commentId });
  };

  return (
    <section className="space-y-4">
      {/* Header + sort + collapse controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Comments</h3>

        <div className="flex items-center gap-2">
          {/* Sort buttons only meaningful when open, but harmless otherwise */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground mr-1">Sort:</span>
            <Button
              type="button"
              size="sm"
              variant={order === "asc" ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setOrder("asc")}
            >
              Oldest
            </Button>
            <Button
              type="button"
              size="sm"
              variant={order === "desc" ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setOrder("desc")}
            >
              Newest
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs"
            onClick={() => setShowComments((v) => !v)}
          >
            {showComments
              ? "Hide comments"
              : totalCount > 0
                ? `Show comments (${totalCount})`
                : "Show comments"}
          </Button>
        </div>
      </div>

      {/* Everything below is hidden until expanded */}
      {showComments && (
        <>
          {/* New top-level comment */}
          <CommentInput
            isLoggedIn={isLoggedIn}
            text={rootText}
            setText={setRootText}
            submit={handlePostRoot}
            submitLabel="Post"
          />

          {/* List states */}
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading comments…</p>
          )}
          {isError && (
            <p className="text-sm text-destructive">
              Couldn’t load comments. Please try again.
            </p>
          )}

          {!isLoading && roots.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Be the first to comment.
            </p>
          )}

          {/* Root comments */}
          {roots.length > 0 && (
            <div className="space-y-2">
              {roots.map((root, index) => (
                <Fragment key={root.id}>
                  {index > 0 && <Separator className="my-2" />}
                  <CommentRow
                    recipeId={recipeId}
                    comment={root}
                    depth={0}
                    isLoggedIn={isLoggedIn}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    order={order}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    onCreate={handleCreate}
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                  />
                </Fragment>
              ))}
            </div>
          )}

          {/* Root-level pagination */}
          {hasNextPage && (
            <div className="pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading…" : "Load more comments"}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
