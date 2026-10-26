"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export default function SortableItem({
  id,
  children,
  compact = false,
  handleLabel,
  instructions,
}: {
  id: string;
  children: React.ReactNode;
  compact?: boolean;
  handleLabel?: string;
  instructions?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      data-slot="sortable-item"
      data-dragging={isDragging}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`${compact ? "inline-flex max-w-full rounded-full" : "flex my-2 rounded-sm"} outline-none ${
        isDragging ? "outline-secondary" : ""
      } border-collapse bg-background`}
      aria-roledescription="sortable item"
    >
      <div
        {...attributes}
        {...listeners}
        data-slot="drag-handle"
        className="grid items-center justify-center bg-secondary hover:bg-secondary mr-2 rounded-l-sm cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        tabIndex={0}
        aria-label={handleLabel ?? `Drag handle for item ${id}`}
        aria-describedby={`drag-instructions-${id}`}
        role="button"
      >
        <GripVertical className="w-6 h-6" />
        <span id={`drag-instructions-${id}`} className="sr-only">
          {instructions ?? "Press Space or Enter to activate drag mode, then use arrow keys to move, and Space or Enter again to drop"}
        </span>
      </div>
      <div className="mr-2 flex-1">{children}</div>
    </div>
  );
}
