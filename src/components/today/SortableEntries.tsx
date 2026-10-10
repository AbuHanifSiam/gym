import type { ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface EntryRow {
  name: string;
  detail: string;
  /** Swap / skip buttons shown under the row. */
  actions: ReactNode;
}

/** The exercise list while editing: drag a row by its handle to put it anywhere. */
export default function SortableEntries({
  rows,
  onReorder,
}: {
  rows: EntryRow[];
  onReorder: (from: number, to: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = rows.map((_, i) => String(i));

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onReorder(Number(active.id), Number(over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {rows.map((row, i) => (
            <SortableRow key={ids[i]} id={ids[i]} index={i} row={row} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, index, row }: { id: string; index: number; row: EntryRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card space-y-2 p-2 ${isDragging ? 'relative z-10 opacity-80 shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="grid min-h-12 w-10 shrink-0 cursor-grab touch-none place-items-center text-xl text-slate-500"
          aria-label={`Drag to reorder ${row.name}`}
        >
          ⠿
        </button>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {index + 1}. {row.name}
          </span>
          <span className="block truncate text-sm text-slate-500">{row.detail}</span>
        </span>
      </div>
      {row.actions}
    </li>
  );
}
