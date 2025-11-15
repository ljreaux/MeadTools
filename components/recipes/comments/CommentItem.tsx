"use client";

import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator
} from "@/components/ui/button-group";
import { Pencil, Trash2 } from "lucide-react";
import type { CommentNode } from "./CommentsSection";
import CommentInput from "./CommentInput";

type CommentItemProps = {
  comment: CommentNode;
  canReply: boolean;
  canEdit?: boolean;
  onReply?: (comment: CommentNode) => void;
  onEdit?: (newText: string) => void;
  onDelete?: () => void;
  children?: React.ReactNode;
};

export function CommentItem({
  comment,
  canReply,
  canEdit,
  onReply,
  onEdit,
  onDelete,
  children
}: CommentItemProps) {
  const username = comment.author?.public_username ?? "Anonymous";
  const avatarUrl = comment.author?.avatarUrl || null;
  const initial = username.trim().charAt(0)?.toUpperCase() || "U";

  const created = new Date(comment.created_at);
  const updated = comment.updated_at ? new Date(comment.updated_at) : created;

  const isDeleted = !!comment.deleted_at;
  const isEdited = !isDeleted && updated.getTime() !== created.getTime();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.comment);

  const handleSave = () => {
    if (!onEdit) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    onEdit(trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(comment.comment);
    setIsEditing(false);
  };

  const showReply = !isDeleted && canReply && onReply;
  const showEdit = !isDeleted && canEdit && onEdit;
  const showDelete = !isDeleted && canEdit && onDelete;

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 mt-1 overflow-hidden">
          <AvatarImage
            src={avatarUrl ?? ""}
            alt={username}
            className="h-8 w-8 object-cover"
            referrerPolicy="no-referrer"
          />
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-1">
          <header className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground text-sm">
              {username}
            </span>
            <span>•</span>
            <span>
              {created.toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </span>
            {isEdited && (
              <span className="text-[10px] text-muted-foreground">
                (edited)
              </span>
            )}

            {isDeleted && (
              <span className="text-[10px] text-destructive">Deleted</span>
            )}
          </header>

          {isDeleted ? (
            <p className="text-xs italic text-muted-foreground">
              This comment was deleted by the author.
            </p>
          ) : isEditing ? (
            <div className="space-y-2">
              {/* Reuse full markdown CommentInput for editing */}
              <CommentInput
                isLoggedIn={true}
                text={draft}
                setText={setDraft}
                submit={handleSave}
                onCancel={handleCancel}
              />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {comment.comment}
              </ReactMarkdown>
            </div>
          )}

          {/* Actions */}
          {!isEditing && (showReply || showEdit || showDelete) && (
            <footer className="mt-1 flex items-center text-xs text-muted-foreground">
              <ButtonGroup aria-label="Comment actions" className="h-7">
                {showReply && onReply && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onReply(comment)}
                  >
                    Reply
                  </Button>
                )}

                {showEdit && (
                  <>
                    {showReply && <ButtonGroupSeparator />}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                  </>
                )}

                {showDelete && (
                  <>
                    {(showReply || showEdit) && <ButtonGroupSeparator />}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => onDelete?.()}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </>
                )}
              </ButtonGroup>
            </footer>
          )}
        </div>
      </div>

      {children && <div className="ml-6 pl-4 space-y-2">{children}</div>}
    </div>
  );
}
