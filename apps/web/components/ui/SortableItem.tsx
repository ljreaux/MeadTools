"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export default function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
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
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex my-2 outline-none ${
        isDragging ? "outline-secondary" : ""
      }  border-collapse rounded-sm bg-background`}
      aria-roledescription="sortable item"
    >
      <div
        {...attributes}
        {...listeners}
        className="grid items-center justify-center bg-secondary hover:bg-secondary mr-2 rounded-l-sm cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        tabIndex={0}
        aria-label={`Drag handle for item ${id}`}
        aria-describedby={`drag-instructions-${id}`}
        role="button"
      >
        <GripVertical className="w-6 h-6" />
        <span id={`drag-instructions-${id}`} className="sr-only">
          Press Space or Enter to activate drag mode, then use arrow keys to
          move, and Space or Enter again to drop
        </span>
      </div>
      <div className="mr-2 flex-1">{children}</div>
    </div>
  );
}
