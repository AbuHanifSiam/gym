import { useMemo, useState, type FormEvent } from 'react';
import {
  bodyLogInputSchema,
  measurementKeys,
  type BodyLog,
  type MeasurementKey,
} from '../../shared/schemas';
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  kgToDisplay,
  lengthUnit,
  localDay,
} from '../../shared/time';
import { useMe } from '../api/auth';
import { useBodyLogs, useDeleteBodyLog, useSaveBodyLog } from '../api/body';
import { ApiError } from '../api/client';
import TrendChart, { shortDate } from '../components/TrendChart';

type Units = 'kg' | 'lb';
type MetricId = 'weight' | MeasurementKey;

const labels: Record<MetricId, string> = {
  weight: 'Weight',
  chest: 'Chest',
  waist: 'Waist',
  arm: 'Arm',
  thigh: 'Thigh',
};

const valueOf = (l: BodyLog, m: MetricId) => (m === 'weight' ? l.weight : l.measurements[m]);
const display = (v: number, m: MetricId, units: Units) =>
  m === 'weight' ? kgToDisplay(v, units) : cmToDisplay(v, units);
const unitOf = (m: MetricId, units: Units) => (m === 'weight' ? units : lengthUnit(units));

export default function BodyPage() {
  const { data: logs, isPending, isError } = useBodyLogs();
  const { data: me } = useMe();
  const units: Units = me?.settings.units ?? 'kg';
  const today = localDay(me?.settings.timezone ?? 'Asia/Dhaka').date;
  const [editDate, setEditDate] = useState<string | null>(null);
  const [picked, setPicked] = useState<MetricId>('weight');

  if (isPending) return <p className="text-slate-500">Loading…</p>;
  if (isError || !logs) return <p className="text-red-600">Couldn't load your body log.</p>;

  const available = (['weight', ...measurementKeys] as MetricId[]).filter((m) =>
    logs.some((l) => valueOf(l, m) != null),
  );
  const metric = available.includes(picked) ? picked : (available[0] ?? 'weight');
  const series = logs
    .filter((l) => valueOf(l, metric) != null)
    .map((l) => ({ date: l.date, value: display(valueOf(l, metric)!, metric, units) }));

  const formDate = editDate ?? today;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Body</h1>

      <WeightStats logs={logs} units={units} today={today} />

      <EntryForm
        key={formDate + (logs.find((l) => l.date === formDate)?.id ?? '')}
        date={formDate}
        today={today}
        existing={logs.find((l) => l.date === formDate)}
        units={units}
        onDateChange={(d) => setEditDate(d === today ? null : d)}
        onSaved={() => setEditDate(null)}
      />

      {available.length > 0 && (
        <section className="card space-y-3" aria-labelledby="body-chart">
          {available.length > 1 && (
            <div
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1"
              role="group"
              aria-label="Measurement"
            >
              {available.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === metric}
                  onClick={() => setPicked(m)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium ${
                    m === metric
                      ? 'bg-emerald-600 text-white'
                      : 'ring-1 ring-slate-300 dark:ring-slate-700'
                  }`}
                >
                  {labels[m]}
                </button>
              ))}
            </div>
          )}
          <h2 id="body-chart" className="font-semibold">
            {labels[metric]}{' '}
            <span className="font-normal text-slate-500">({unitOf(metric, units)})</span>
          </h2>
          {series.length < 2 ? (
            <p className="text-sm text-slate-500">The chart appears after your second entry.</p>
          ) : (
            <TrendChart
              data={series}
              unit={unitOf(metric, units)}
              label={`${labels[metric]} over time`}
            />
          )}
        </section>
      )}

      <History
        logs={logs}
        units={units}
        onEdit={(d) => {
          setEditDate(d);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </section>
  );
}

function WeightStats({ logs, units, today }: { logs: BodyLog[]; units: Units; today: string }) {
  const weighed = logs.filter((l) => l.weight != null);
  const latest = weighed.at(-1);
  if (!latest) return null;
  const first = weighed[0];
  // Closest entry on or before 30 days ago, else the first.
  const monthAgo = new Date(`${today}T00:00:00Z`);
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);
  const cutoff = monthAgo.toISOString().slice(0, 10);
  const base = [...weighed].reverse().find((l) => l.date <= cutoff) ?? first;

  const change = (from: BodyLog) => {
    const diff = kgToDisplay(latest.weight! - from.weight!, units);
    return `${diff > 0 ? '+' : ''}${diff} ${units}`;
  };

  return (
    <dl className="grid grid-cols-2 gap-2">
      <div className="card">
        <dt className="text-xs font-semibold text-slate-500 uppercase">Current weight</dt>
        <dd className="mt-1">
          <span className="text-3xl font-bold tabular-nums">
            {kgToDisplay(latest.weight!, units)}
          </span>
          <span className="ml-1 text-sm text-slate-500">{units}</span>
          <span className="block text-xs text-slate-500">{shortDate(latest.date)}</span>
        </dd>
      </div>
      <div className="card">
        <dt className="text-xs font-semibold text-slate-500 uppercase">Change</dt>
        <dd className="mt-1">
          {base === latest ? (
            <span className="text-slate-400">Log again to see change</span>
          ) : (
            <>
              <span className="text-2xl font-bold tabular-nums">{change(base)}</span>
              <span className="block text-xs text-slate-500">since {shortDate(base.date)}</span>
            </>
          )}
        </dd>
      </div>
    </dl>
  );
}

const parse = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function EntryForm({
  date,
  today,
  existing,
  units,
  onDateChange,
  onSaved,
}: {
  date: string;
  today: string;
  existing: BodyLog | undefined;
  units: Units;
  onDateChange: (date: string) => void;
  onSaved: () => void;
}) {
  const save = useSaveBodyLog();
  const str = (v: number | null | undefined, conv: (n: number) => number) =>
    v == null ? '' : String(conv(v));
  const [weight, setWeight] = useState(str(existing?.weight, (n) => kgToDisplay(n, units)));
  const [m, setM] = useState<Record<MeasurementKey, string>>(
    () =>
      Object.fromEntries(
        measurementKeys.map((k) => [
          k,
          str(existing?.measurements[k], (n) => cmToDisplay(n, units)),
        ]),
      ) as Record<MeasurementKey, string>,
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showMeasure, setShowMeasure] = useState(
    () => !!existing && measurementKeys.some((k) => existing.measurements[k] != null),
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const lu = lengthUnit(units);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const w = parse(weight);
    const parsed = bodyLogInputSchema.safeParse({
      date,
      weight: w == null ? null : displayToKg(w, units),
      measurements: Object.fromEntries(
        measurementKeys.map((k) => {
          const v = parse(m[k]);
          return [k, v == null ? null : displayToCm(v, units)];
        }),
      ),
      notes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3" noValidate>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{existing ? 'Edit entry' : 'Log your body'}</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Date</span>
          <input
            type="date"
            className="input min-h-11 w-auto py-0"
            value={date}
            max={today}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Weight ({units})</span>
        <input
          className="input text-lg font-semibold tabular-nums"
          inputMode="decimal"
          placeholder={`e.g. ${units === 'kg' ? '72.5' : '160'}`}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </label>

      <button
        type="button"
        className="min-h-11 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
        aria-expanded={showMeasure}
        onClick={() => setShowMeasure((v) => !v)}
      >
        {showMeasure ? '▾ Measurements' : '▸ Add measurements (optional)'}
      </button>
      {showMeasure && (
        <div className="grid grid-cols-2 gap-2">
          {measurementKeys.map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-sm font-medium">
                {labels[k]} ({lu})
              </span>
              <input
                className="input tabular-nums"
                inputMode="decimal"
                value={m[k]}
                onChange={(e) => setM({ ...m, [k]: e.target.value })}
              />
            </label>
          ))}
          <p className="col-span-2 text-xs text-slate-500">
            Measure in the morning, relaxed. Arm: biggest part of the upper arm. Thigh: biggest
            part. Waist: at the belly button.
          </p>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Notes</span>
        <input
          className="input"
          maxLength={500}
          placeholder="Optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          ✓ Saved
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : existing ? 'Update entry' : 'Save'}
      </button>
    </form>
  );
}

function History({
  logs,
  units,
  onEdit,
}: {
  logs: BodyLog[];
  units: Units;
  onEdit: (date: string) => void;
}) {
  const del = useDeleteBodyLog();
  const [showAll, setShowAll] = useState(false);
  const newestFirst = useMemo(() => [...logs].reverse(), [logs]);
  if (logs.length === 0) return null;
  const shown = showAll ? newestFirst : newestFirst.slice(0, 10);
  const lu = lengthUnit(units);

  return (
    <section aria-labelledby="body-history">
      <h2 id="body-history" className="mb-2 font-semibold">
        Entries
      </h2>
      <ul className="space-y-2">
        {shown.map((l) => {
          const parts = measurementKeys
            .filter((k) => l.measurements[k] != null)
            .map((k) => `${labels[k]} ${cmToDisplay(l.measurements[k]!, units)}`);
          return (
            <li key={l.id} className="card flex items-center gap-3 py-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onEdit(l.date)}
              >
                <span className="block font-semibold">
                  {shortDate(l.date)}
                  {l.weight != null && (
                    <span className="ml-2 tabular-nums">
                      {kgToDisplay(l.weight, units)} {units}
                    </span>
                  )}
                </span>
                {(parts.length > 0 || l.notes) && (
                  <span className="block truncate text-sm text-slate-500">
                    {parts.length > 0 && `${parts.join(' · ')} ${lu}`}
                    {parts.length > 0 && l.notes && ' · '}
                    {l.notes}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="btn-ghost min-h-11 shrink-0 px-3 text-sm text-red-600"
                aria-label={`Delete entry for ${l.date}`}
                onClick={() => confirm(`Delete the entry for ${l.date}?`) && del.mutate(l.id)}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      {newestFirst.length > 10 && !showAll && (
        <button type="button" className="btn-ghost mt-2 w-full" onClick={() => setShowAll(true)}>
          Show all {newestFirst.length} entries
        </button>
      )}
    </section>
  );
}
