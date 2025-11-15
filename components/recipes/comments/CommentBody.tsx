"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function CommentBody({ comment }: { comment: string }) {
  const safe = comment.trim() || "_(no content)_";

  return (
    <div className="prose prose-invert max-w-none text-sm break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{safe}</ReactMarkdown>
    </div>
  );
}
