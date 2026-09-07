import * as React from "react";

import { cn } from "@/lib/utils";

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2", className)}
      data-slot="message-group"
      {...props}
    />
  );
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className,
      )}
      data-align={align}
      data-slot="message"
      {...props}
    />
  );
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 break-words group-data-[align=end]/message:*:data-slot:self-end",
        className,
      )}
      data-slot="message-content"
      {...props}
    />
  );
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex max-w-full min-w-0 items-center px-3 text-xs font-medium text-muted-foreground group-data-[align=end]/message:justify-end",
        className,
      )}
      data-slot="message-footer"
      {...props}
    />
  );
}

export { MessageGroup, Message, MessageContent, MessageFooter };
