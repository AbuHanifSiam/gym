import { useState } from 'react';
import type { SessionSet } from '../../../shared/schemas';
import { displayToKg, kgToDisplay } from '../../../shared/time';

const parseNum = (v: string, decimal: boolean): number | null => {
  const n = decimal ? parseFloat(v.replace(',', '.')) : parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** One set: weight + reps (or seconds) inputs and a large done button. */
export default function SetRow({
  set,
  label,
  showWeight,
  timed,
  units,
  previous,
  targetHint,
  onChange,
  onToggle,
}: {
  set: SessionSet;
  label: string;
  showWeight: boolean;
  timed: boolean;
  units: 'kg' | 'lb';
  /** "Last time" values for this set, shown as placeholders and a hint. */
  previous?: SessionSet;
  targetHint: string;
  onChange: (patch: Partial<SessionSet>) => void;
  onToggle: () => void;
}) {
  // Local text so typing "12." or clearing a field feels natural. If the stored value changes
  // from outside (e.g. a tick fills in last time's numbers), show the new value.
  const weightValue = set.weight == null ? null : kgToDisplay(set.weight, units);
  const amountValue = (timed ? set.durationSec : set.reps) ?? null;
  const [weight, setWeight] = useState(weightValue == null ? '' : String(weightValue));
  const [amount, setAmount] = useState(amountValue == null ? '' : String(amountValue));
  if (parseNum(weight, true) !== weightValue)
    setWeight(weightValue == null ? '' : String(weightValue));
  if (parseNum(amount, false) !== amountValue)
    setAmount(amountValue == null ? '' : String(amountValue));

  const prevWeight = previous?.weight != null ? kgToDisplay(previous.weight, units) : null;
  const prevAmount = timed ? previous?.durationSec : previous?.reps;
  const prevText = previous
    ? `${prevWeight != null ? `${prevWeight} ${units} × ` : ''}${prevAmount ?? '–'}${timed ? ' s' : ''}`
    : null;

  const inputCls = `input min-h-14 px-2 text-center text-lg font-semibold tabular-nums ${
    set.done ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : ''
  }`;

  return (
    <div className="flex items-center gap-2">
      <div className="w-12 shrink-0 text-center">
        <p className="text-sm font-bold">{label}</p>
        {prevText && (
          <p className="text-[10px] leading-tight text-slate-500" title="Last time">
            {prevText}
          </p>
        )}
      </div>
      {showWeight && (
        <label className="min-w-0 flex-1">
          <span className="sr-only">
            Set {label} weight in {units}
          </span>
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder={prevWeight != null ? String(prevWeight) : units}
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              const n = parseNum(e.target.value, true);
              onChange({ weight: n == null ? null : displayToKg(n, units) });
            }}
          />
        </label>
      )}
      <label className="min-w-0 flex-1">
        <span className="sr-only">
          Set {label} {timed ? 'seconds' : 'reps'}
        </span>
        <input
          className={inputCls}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={prevAmount != null ? String(prevAmount) : targetHint}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            const n = parseNum(e.target.value, false);
            onChange(timed ? { durationSec: n } : { reps: n });
          }}
        />
      </label>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={set.done}
        aria-label={`Set ${label} ${set.done ? 'done, tap to undo' : 'mark done'}`}
        className={`grid size-14 shrink-0 place-items-center rounded-xl text-2xl font-bold transition active:scale-95 ${
          set.done
            ? 'bg-emerald-700 text-white'
            : 'bg-white text-slate-300 ring-2 ring-slate-300 dark:bg-slate-900 dark:text-slate-600 dark:ring-slate-700'
        }`}
      >
        ✓
      </button>
    </div>
  );
}
