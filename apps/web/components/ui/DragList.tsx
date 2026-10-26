"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  rectSortingStrategy
} from "@dnd-kit/sortable";

import SortableItem from "./SortableItem";

export default function DragList<T>({
  items,
  setItems,
  getId,
  renderItem,
  layout = "vertical",
  getDragLabel,
  dragInstructions
}: {
  items: T[];
  setItems: (arr: T[]) => void;
  getId: (item: T) => string;
  renderItem?: (item: T, i: number) => React.ReactNode;
  layout?: "vertical" | "wrapped";
  getDragLabel?: (item: T) => string;
  dragInstructions?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => getId(item) === active.id);
    const newIndex = items.findIndex((item) => getId(item) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = [...items];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);

    setItems(next);
  };

  const itemIds = items.map(getId);
  const content = items.map((item, i) => {
    const id = getId(item);
    return <SortableItem key={id} id={id} compact={layout === "wrapped"} handleLabel={getDragLabel?.(item)} instructions={dragInstructions}>
      {renderItem ? renderItem(item, i) : id}
    </SortableItem>;
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={layout === "wrapped" ? rectSortingStrategy : verticalListSortingStrategy}>
        {layout === "wrapped" ? <div className="flex flex-wrap gap-2">{content}</div> : content}
      </SortableContext>
    </DndContext>
  );
}
