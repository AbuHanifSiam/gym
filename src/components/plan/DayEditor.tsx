import { useState } from 'react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { weekdayNames, type Exercise } from '../../../shared/schemas';
import ItemEditor, { itemSummary } from './ItemEditor';
import { newUid, type DraftDay, type DraftItem } from './types';

export default function DayEditor({
  day,
  dayOrder,
  exercises,
  onChange,
  onCopyTo,
  errors,
}: {
  day: DraftDay;
  /** Weekdays in display order, for the "copy to" menu. */
  dayOrder: number[];
  exercises: Exercise[];
  onChange: (day: DraftDay) => void;
  onCopyTo: (targetDayIndex: number) => void;
  /** Field errors for this day, keyed like "items.2.repsMax". */
  errors: Record<string, string>;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [adding, setAdding] = useState('');
  const byId = new Map(exercises.map((e) => [e.id, e]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setItems = (items: DraftItem[]) => onChange({ ...day, items });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= day.items.length) return;
    setItems(arrayMove(day.items, from, to));
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = day.items.findIndex((i) => i.uid === active.id);
    const to = day.items.findIndex((i) => i.uid === over.id);
    move(from, to);
  }

  function addExercise(exerciseId: string) {
    const ex = byId.get(exerciseId);
    if (!ex) return;
    const timed = ex.measure === 'time';
    const item: DraftItem = {
      uid: newUid(),
      exerciseId,
      sets: 3,
      repsMin: timed ? null : 10,
      repsMax: timed ? null : 12,
      durationSec: timed ? 30 : null,
      variationKey: '',
      notes: '',
    };
    setItems([...day.items, item]);
    setOpenItem(item.uid);
    setAdding('');
  }

  const errorsFor = (i: number) => {
    const prefix = `items.${i}.`;
    return Object.fromEntries(
      Object.entries(errors)
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => [k.slice(prefix.length), v]),
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Day type">
        {(['train', 'rest'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={day.type === t}
            className={`btn ${day.type === t ? 'bg-emerald-700 text-white' : 'btn-ghost'}`}
            onClick={() =>
              onChange({
                ...day,
                type: t,
                intensity: t === 'train' ? (day.intensity ?? 'moderate') : null,
                label: t === 'rest' ? 'Rest' : day.label === 'Rest' ? '' : day.label,
              })
            }
          >
            {t === 'train' ? 'Training' : 'Rest day'}
          </button>
        ))}
      </div>

      {day.type === 'train' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`label-${day.dayIndex}`} className="mb-1 block text-sm font-medium">
                Label
              </label>
              <input
                id={`label-${day.dayIndex}`}
                className="input"
                maxLength={40}
                placeholder="e.g. Day 1"
                value={day.label}
                onChange={(e) => onChange({ ...day, label: e.target.value })}
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">Intensity</span>
              <div className="grid grid-cols-2 gap-1" role="group" aria-label="Intensity">
                {(['hard', 'moderate'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={day.intensity === v}
                    className={`min-h-12 rounded-xl text-sm font-semibold capitalize ${
                      day.intensity === v
                        ? v === 'hard'
                          ? 'bg-orange-500 text-white'
                          : 'bg-sky-600 text-white'
                        : 'ring-1 ring-inset ring-slate-300 dark:ring-slate-700'
                    }`}
                    onClick={() => onChange({ ...day, intensity: v })}
                  >
                    {v === 'moderate' ? 'Mod.' : v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={day.items.map((i) => i.uid)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="space-y-2">
                {day.items.map((item, i) => (
                  <SortableRow key={item.uid} id={item.uid}>
                    {(handle) => {
                      const ex = byId.get(item.exerciseId);
                      const grip = ex?.variations.find((v) => v.key === item.variationKey);
                      const open = openItem === item.uid;
                      const hasError = Object.keys(errorsFor(i)).length > 0;
                      return (
                        <div
                          className={`rounded-xl bg-slate-50 p-2 ring-1 dark:bg-slate-950 ${
                            hasError ? 'ring-red-500' : 'ring-slate-200 dark:ring-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              {...handle}
                              className="grid min-h-12 w-9 shrink-0 cursor-grab touch-none place-items-center text-xl text-slate-500"
                              aria-label={`Drag to reorder ${ex?.name ?? 'exercise'}`}
                            >
                              ⠿
                            </button>
                            <button
                              type="button"
                              className="min-h-12 min-w-0 flex-1 text-left"
                              aria-expanded={open}
                              onClick={() => setOpenItem(open ? null : item.uid)}
                            >
                              <span className="block truncate font-medium">
                                {i + 1}. {ex?.name ?? 'Missing exercise'}
                              </span>
                              <span className="block truncate text-sm text-slate-500">
                                {itemSummary(item, ex)}
                                {grip && ` · ${grip.name}`}
                                {item.notes && ` · ${item.notes}`}
                              </span>
                            </button>
                            <div className="flex shrink-0">
                              <button
                                type="button"
                                className="grid size-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                                onClick={() => move(i, i - 1)}
                                disabled={i === 0}
                                aria-label={`Move ${ex?.name ?? 'exercise'} up`}
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                className="grid size-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"
                                onClick={() => move(i, i + 1)}
                                disabled={i === day.items.length - 1}
                                aria-label={`Move ${ex?.name ?? 'exercise'} down`}
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                          {open && (
                            <ItemEditor
                              item={item}
                              exercises={exercises}
                              errors={errorsFor(i)}
                              onChange={(patch) =>
                                setItems(
                                  day.items.map((x) =>
                                    x.uid === item.uid ? { ...x, ...patch } : x,
                                  ),
                                )
                              }
                              onRemove={() => {
                                setItems(day.items.filter((x) => x.uid !== item.uid));
                                setOpenItem(null);
                              }}
                            />
                          )}
                        </div>
                      );
                    }}
                  </SortableRow>
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          {day.items.length === 0 && (
            <p className="text-center text-sm text-slate-500">No exercises yet.</p>
          )}

          <div>
            <label htmlFor={`add-${day.dayIndex}`} className="sr-only">
              Add exercise
            </label>
            <select
              id={`add-${day.dayIndex}`}
              className="input font-medium text-emerald-700 dark:text-emerald-400"
              value={adding}
              onChange={(e) => addExercise(e.target.value)}
            >
              <option value="">+ Add exercise…</option>
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label htmlFor={`copy-${day.dayIndex}`} className="mb-1 block text-sm font-medium">
          Copy this day to…
        </label>
        <select
          id={`copy-${day.dayIndex}`}
          className="input"
          value=""
          onChange={(e) => e.target.value && onCopyTo(Number(e.target.value))}
        >
          <option value="">Choose a day</option>
          {dayOrder
            .filter((d) => d !== day.dayIndex)
            .map((d) => (
              <option key={d} value={d}>
                {weekdayNames[d]}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: Record<string, unknown>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-80 shadow-lg' : undefined}
    >
      {children({ ...attributes, ...listeners })}
    </li>
  );
}
