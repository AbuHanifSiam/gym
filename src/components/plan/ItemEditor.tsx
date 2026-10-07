import type { Exercise } from '../../../shared/schemas';
import type { DraftItem } from './types';

/** "3 × 10–12", "3 × max", "3 × 30 s" */
export function itemSummary(item: DraftItem, exercise?: Exercise): string {
  const timed = exercise?.measure === 'time' || item.durationSec != null;
  let amount: string;
  if (timed) {
    const s = item.durationSec ?? 0;
    amount = s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`;
  } else if (item.repsMin == null && item.repsMax == null) amount = 'max';
  else if (item.repsMin === item.repsMax || item.repsMax == null) amount = `${item.repsMin}`;
  else if (item.repsMin == null) amount = `${item.repsMax}`;
  else amount = `${item.repsMin}–${item.repsMax}`;
  return `${item.sets} × ${amount}`;
}

const toNum = (v: string): number | null => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function ItemEditor({
  item,
  exercises,
  onChange,
  onRemove,
  errors,
}: {
  item: DraftItem;
  exercises: Exercise[];
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
  errors: Record<string, string>;
}) {
  const exercise = exercises.find((e) => e.id === item.exerciseId);
  const timed = exercise?.measure === 'time';
  const id = item.uid;

  return (
    <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
      <div>
        <label htmlFor={`${id}-ex`} className="mb-1 block text-sm font-medium">
          Exercise
        </label>
        <select
          id={`${id}-ex`}
          className="input"
          value={item.exerciseId}
          onChange={(e) => {
            const next = exercises.find((x) => x.id === e.target.value);
            onChange({
              exerciseId: e.target.value,
              variationKey: '',
              ...(next?.measure === 'time'
                ? { durationSec: item.durationSec ?? 30, repsMin: null, repsMax: null }
                : { durationSec: null }),
            });
          }}
        >
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <NumField
          id={`${id}-sets`}
          label="Sets"
          value={item.sets}
          onChange={(v) => onChange({ sets: v ?? 1 })}
          error={errors.sets}
        />
        {timed ? (
          <div className="col-span-2">
            <NumField
              id={`${id}-dur`}
              label="Seconds"
              value={item.durationSec}
              onChange={(v) => onChange({ durationSec: v })}
              error={errors.durationSec}
            />
          </div>
        ) : (
          <>
            <NumField
              id={`${id}-min`}
              label="Reps min"
              value={item.repsMin}
              placeholder="max"
              onChange={(v) => onChange({ repsMin: v })}
              error={errors.repsMin}
            />
            <NumField
              id={`${id}-max`}
              label="Reps max"
              value={item.repsMax}
              placeholder="max"
              onChange={(v) => onChange({ repsMax: v })}
              error={errors.repsMax}
            />
          </>
        )}
      </div>
      {!timed && (
        <p className="-mt-1 text-xs text-slate-500">Leave reps empty for "max with good form".</p>
      )}

      {exercise && exercise.variations.length > 0 && (
        <div>
          <label htmlFor={`${id}-grip`} className="mb-1 block text-sm font-medium">
            Grip / variation
          </label>
          <select
            id={`${id}-grip`}
            className="input"
            value={item.variationKey}
            onChange={(e) => onChange({ variationKey: e.target.value })}
          >
            <option value="">Any / choose at the gym</option>
            {exercise.variations.map((v) => (
              <option key={v.key} value={v.key}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor={`${id}-notes`} className="mb-1 block text-sm font-medium">
          Notes
        </label>
        <input
          id={`${id}-notes`}
          className="input"
          maxLength={200}
          placeholder="e.g. Light weight, per side"
          value={item.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>

      <button type="button" className="btn-ghost w-full text-red-600" onClick={onRemove}>
        Remove from this day
      </button>
    </div>
  );
}

function NumField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="input text-center"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(toNum(e.target.value))}
        aria-invalid={!!error}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
