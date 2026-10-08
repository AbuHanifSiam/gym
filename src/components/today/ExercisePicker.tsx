import { useEffect, useMemo, useRef, useState } from 'react';
import { categories, type Exercise } from '../../../shared/schemas';
import { useExercises } from '../../api/exercises';

/**
 * Bottom sheet for choosing an exercise to swap in or add to today's workout.
 * When swapping, exercises from the same category are listed first.
 */
export default function ExercisePicker({
  title,
  preferCategory,
  inWorkout,
  onPick,
  onClose,
}: {
  title: string;
  preferCategory?: Exercise['category'];
  /** Exercise ids already in today's workout, marked in the list. */
  inWorkout: Set<string>;
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { data, isPending, isError } = useExercises();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>(preferCategory ?? 'all');

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? [])
      .filter((e) => category === 'all' || e.category === category)
      .filter(
        (e) =>
          !needle ||
          e.name.toLowerCase().includes(needle) ||
          e.muscles.some((m) => m.toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, q, category]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mt-auto mb-0 max-h-[85dvh] w-full max-w-xl flex-col rounded-t-2xl bg-slate-50 p-0 text-inherit backdrop:bg-black/60 open:flex dark:bg-slate-950"
      aria-label={title}
    >
      <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className="btn-ghost min-h-11 px-3 text-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
        <input
          type="search"
          className="input"
          placeholder="Search name or muscle"
          aria-label="Search exercises"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1"
          role="group"
          aria-label="Category"
        >
          {['all', ...categories].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium capitalize ${
                category === c
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white ring-1 ring-inset ring-slate-300 dark:bg-slate-900 dark:ring-slate-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isPending && <p className="text-slate-500">Loading exercises…</p>}
        {isError && <p className="text-red-600">Couldn't load exercises. Check your connection.</p>}
        {data && list.length === 0 && <p className="text-slate-500">No exercises match.</p>}
        <ul className="space-y-1.5">
          {list.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="card flex min-h-14 w-full items-center gap-3 py-2 text-left"
                onClick={() => onPick(e)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{e.name}</span>
                  <span className="block truncate text-sm text-slate-500 capitalize">
                    {e.category} · {e.equipment}
                    {e.muscles.length > 0 && ` · ${e.muscles.slice(0, 3).join(', ')}`}
                  </span>
                </span>
                {inWorkout.has(e.id) && (
                  <span className="shrink-0 text-xs text-slate-500">in today</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
