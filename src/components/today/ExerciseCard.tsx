import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Exercise, LastPerformance, SessionEntry, SessionSet } from '../../../shared/schemas';
import { kgToDisplay } from '../../../shared/time';
import ImageGallery from '../ImageGallery';
import SetRow from './SetRow';

export function targetText(t: SessionEntry['target'], timed: boolean): string {
  if (timed) {
    const s = t.durationSec ?? 0;
    return s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`;
  }
  if (t.repsMin == null && t.repsMax == null) return 'max';
  if (t.repsMin == null || t.repsMin === t.repsMax) return `${t.repsMax ?? t.repsMin}`;
  if (t.repsMax == null) return `${t.repsMin}+`;
  return `${t.repsMin}–${t.repsMax}`;
}

export default function ExerciseCard({
  index,
  entry,
  exercise,
  last,
  units,
  open,
  onToggleOpen,
  onSetChange,
  onSetToggle,
  onAddSet,
  onRemoveSet,
  onVariation,
  actions,
}: {
  index: number;
  entry: SessionEntry;
  exercise: Exercise | undefined;
  last: LastPerformance | undefined;
  units: 'kg' | 'lb';
  open: boolean;
  onToggleOpen: () => void;
  onSetChange: (setIdx: number, patch: Partial<SessionSet>) => void;
  onSetToggle: (setIdx: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onVariation: (key: string) => void;
  /** Today-only changes (reorder, swap, skip), shown while editing the list. */
  actions?: ReactNode;
}) {
  const [showHow, setShowHow] = useState(false);
  const timed = exercise?.measure === 'time' || entry.target.durationSec != null;
  const showWeight = !timed && exercise?.equipment !== 'bodyweight';
  const grip = exercise?.variations.find((v) => v.key === entry.variationKey);
  const done = entry.sets.filter((s) => s.done).length;
  const complete = entry.sets.length > 0 && done === entry.sets.length;
  const target = targetText(entry.target, timed);
  const gripImages =
    exercise?.images.filter((i) => i.variationKey && i.variationKey === entry.variationKey) ?? [];
  const generalImages =
    exercise?.images.filter(
      (i) => !i.variationKey || !exercise.variations.some((v) => v.key === i.variationKey),
    ) ?? [];

  const lastSummary =
    last && last.sets.length
      ? last.sets
          .map((s) =>
            timed
              ? `${s.durationSec ?? '–'}s`
              : `${s.weight != null ? `${kgToDisplay(s.weight, units)}×` : ''}${s.reps ?? '–'}`,
          )
          .join(', ')
      : null;

  return (
    <li
      className={`card p-0 transition ${complete ? 'opacity-70' : ''} ${
        open ? 'ring-2 ring-emerald-500' : ''
      }`}
    >
      <button
        type="button"
        className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
            complete
              ? 'bg-emerald-700 text-white'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
          aria-hidden
        >
          {complete ? '✓' : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {exercise?.name ?? 'Unknown exercise'}
          </span>
          <span className="block truncate text-sm text-slate-500">
            {entry.sets.length} × {target}
            {grip && ` · ${grip.name}`}
            {entry.target.notes && ` · ${entry.target.notes}`}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-slate-500 tabular-nums">
          {done}/{entry.sets.length}
        </span>
      </button>

      {actions && <div className="px-4 pb-3">{actions}</div>}

      {open && !actions && (
        <div className="space-y-4 px-4 pb-4">
          {exercise && exercise.variations.length > 0 && (
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/50">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-300">
                  Grip today
                </span>
                <select
                  className="input min-h-11"
                  value={entry.variationKey}
                  onChange={(e) => onVariation(e.target.value)}
                >
                  <option value="">Any</option>
                  {exercise.variations.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              {grip && (
                <p className="mt-2 text-sm">
                  {grip.description}
                  {grip.works && <span className="text-slate-500"> · Works: {grip.works}</span>}
                </p>
              )}
              <ImageGallery images={gripImages} size="small" />
            </div>
          )}

          {lastSummary && (
            <p className="text-sm text-slate-500">
              Last time ({last!.date}): <span className="font-medium">{lastSummary}</span>
              {units && !timed && last!.sets.some((s) => s.weight != null) && ` ${units}`}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex gap-2 px-1 text-xs font-semibold text-slate-500 uppercase">
              <span className="w-12 shrink-0 text-center">Set</span>
              {showWeight && <span className="flex-1 text-center">{units}</span>}
              <span className="flex-1 text-center">{timed ? 'Seconds' : 'Reps'}</span>
              <span className="w-14 shrink-0" />
            </div>
            {entry.sets.map((s, si) => (
              <SetRow
                key={si}
                set={s}
                label={String(s.setNumber)}
                showWeight={showWeight}
                timed={timed}
                units={units}
                previous={last?.sets.find((p) => p.setNumber === s.setNumber)}
                targetHint={target}
                onChange={(patch) => onSetChange(si, patch)}
                onToggle={() => onSetToggle(si)}
              />
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" className="btn-ghost min-h-11 text-sm" onClick={onAddSet}>
                + Add set
              </button>
              <button
                type="button"
                className="btn-ghost min-h-11 text-sm"
                onClick={onRemoveSet}
                disabled={entry.sets.length === 0}
              >
                − Remove set
              </button>
            </div>
          </div>

          {exercise && (exercise.steps.length > 0 || generalImages.length > 0) && (
            <div>
              <button
                type="button"
                className="min-h-11 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                aria-expanded={showHow}
                onClick={() => setShowHow((v) => !v)}
              >
                {showHow ? '▾ Hide how-to' : '▸ How to do it'}
              </button>
              {showHow && (
                <div className="space-y-3">
                  <ImageGallery images={generalImages} size="small" />
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {exercise.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  <Link
                    to={`/exercises/${exercise.id}`}
                    className="text-sm text-emerald-700 underline"
                  >
                    Full exercise page
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
