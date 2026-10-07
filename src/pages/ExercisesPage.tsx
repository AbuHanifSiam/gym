import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categories } from '../../shared/schemas';
import { useExercises, useSeedExercises } from '../api/exercises';

export default function ExercisesPage() {
  const { data: exercises, isPending, isError } = useExercises();
  const seed = useSeedExercises();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exercises ?? []).filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.muscles.some((m) => m.toLowerCase().includes(q))),
    );
  }, [exercises, query, category]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Exercises</h1>
        <Link to="/exercises/new" className="btn-primary min-h-11 px-4">
          + Add
        </Link>
      </div>

      <label className="block">
        <span className="sr-only">Search exercises</span>
        <input
          type="search"
          className="input"
          placeholder="Search name or muscle"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
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
                : 'bg-white ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isPending && <p className="text-slate-500">Loading…</p>}
      {isError && <p className="text-red-600">Couldn't load exercises.</p>}

      {exercises && exercises.length === 0 && (
        <div className="card space-y-3 text-center">
          <p>Your library is empty.</p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
          >
            {seed.isPending ? 'Loading…' : 'Load default exercises'}
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map((e) => (
          <li key={e.id}>
            <Link
              to={`/exercises/${e.id}`}
              className="card flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{e.name}</p>
                <p className="truncate text-sm text-slate-500 capitalize">
                  {e.category} · {e.equipment}
                  {e.variations.length > 0 && ` · ${e.variations.length} grips`}
                </p>
              </div>
              <span aria-hidden className="text-slate-400">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {exercises && exercises.length > 0 && filtered.length === 0 && (
        <p className="text-center text-slate-500">No matches.</p>
      )}

      {exercises && exercises.length > 0 && (
        <div className="pt-4 text-center">
          <button
            type="button"
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400 underline-offset-4 hover:underline"
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
          >
            Restore missing default exercises
          </button>
          {seed.data && (
            <p className="mt-1 text-sm text-slate-500" role="status">
              {seed.data.added === 0
                ? 'All defaults already present.'
                : `Added ${seed.data.added}.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
