import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  orderedDays,
  planInputSchema,
  weekdayNames,
  type Exercise,
  type Plan,
} from '../../shared/schemas';
import { useMe } from '../api/auth';
import { ApiError } from '../api/client';
import { useExercises } from '../api/exercises';
import {
  useActivatePlan,
  useDeletePlan,
  useDuplicatePlan,
  usePlan,
  useSavePlan,
  useUpdateSettings,
} from '../api/plans';
import DayEditor from '../components/plan/DayEditor';
import IntensityChip from '../components/IntensityChip';
import { fromDraftDay, newUid, toDraftDay, type DraftDay } from '../components/plan/types';

export default function PlanBuilderPage() {
  const { id } = useParams();
  const plan = usePlan(id);
  const exercises = useExercises();

  if (plan.isPending || exercises.isPending) return <p className="text-slate-500">Loading…</p>;
  if (plan.isError || !plan.data)
    return (
      <p>
        Plan not found. <Link to="/plan">Back to plans</Link>
      </p>
    );
  return <Builder key={plan.data.id} plan={plan.data} exercises={exercises.data ?? []} />;
}

function Builder({ plan, exercises }: { plan: Plan; exercises: Exercise[] }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const weekStart = me?.settings.weekStartDay ?? 6;
  const save = useSavePlan();
  const activate = useActivatePlan();
  const duplicate = useDuplicatePlan();
  const del = useDeletePlan();
  const updateSettings = useUpdateSettings();

  const [name, setName] = useState(plan.name);
  const [days, setDays] = useState<DraftDay[]>(() => plan.days.map(toDraftDay));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const sortedExercises = useMemo(
    () => [...exercises].sort((a, b) => a.name.localeCompare(b.name)),
    [exercises],
  );
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const shown = orderedDays(days, weekStart);
  const dayOrder = shown.map((d) => d.dayIndex);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  function updateDay(day: DraftDay) {
    setDays((ds) => ds.map((d) => (d.dayIndex === day.dayIndex ? day : d)));
    setDirty(true);
  }

  function copyDay(from: DraftDay, to: number) {
    const target = days.find((d) => d.dayIndex === to)!;
    const hasContent = target.type === 'train' && target.items.length > 0;
    if (
      hasContent &&
      !confirm(`Replace ${weekdayNames[to]} with a copy of ${weekdayNames[from.dayIndex]}?`)
    )
      return;
    updateDay({
      ...from,
      dayIndex: to,
      label: target.label && target.type === 'train' ? target.label : from.label,
      items: from.items.map((i) => ({ ...i, uid: newUid() })),
    });
    setOpenDay(to);
  }

  async function onSave() {
    setMessage('');
    const parsed = planInputSchema.safeParse({ name, days: days.map(fromDraftDay) });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join('.')] ??= i.message;
      showErrors(errs);
      return;
    }
    try {
      await save.mutateAsync({ id: plan.id, input: parsed.data });
      setDirty(false);
      setErrors({});
    } catch (err) {
      if (err instanceof ApiError) {
        showErrors(err.fields);
        if (!Object.keys(err.fields).length) setMessage(err.message);
      } else setMessage('Could not save. Check your connection.');
    }
  }

  function showErrors(errs: Record<string, string>) {
    setErrors(errs);
    setMessage('Please fix the highlighted items.');
    // Open the first day with a problem. Error keys use the array position in `days`.
    const first = Object.keys(errs).find((k) => k.startsWith('days.'));
    if (first) setOpenDay(days[Number(first.split('.')[1])]?.dayIndex ?? null);
  }

  /** Errors for one day, with the "days.N." prefix removed. */
  function dayErrors(dayIndex: number) {
    const pos = days.findIndex((d) => d.dayIndex === dayIndex);
    const prefix = `days.${pos}.`;
    return Object.fromEntries(
      Object.entries(errors)
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => [k.slice(prefix.length), v]),
    );
  }

  async function onDelete() {
    if (!confirm(`Delete plan "${plan.name}"? Your workout history is kept.`)) return;
    await del.mutateAsync(plan.id);
    navigate('/plan', { replace: true });
  }

  async function onDuplicate() {
    if (dirty && !confirm('Duplicate without your unsaved changes?')) return;
    const { plan: copy } = await duplicate.mutateAsync(plan.id);
    navigate(`/plan/${copy.id}`);
  }

  return (
    <div className="space-y-4">
      <Link
        to="/plan"
        className="inline-block py-2 text-sm text-emerald-600"
        onClick={(e) => dirty && !confirm('Leave without saving?') && e.preventDefault()}
      >
        ‹ Plans
      </Link>

      <div>
        <label htmlFor="plan-name" className="mb-1 block text-sm font-medium">
          Plan name
        </label>
        <input
          id="plan-name"
          className="input text-lg font-semibold"
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div className="flex items-center gap-3">
        {plan.isActive ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
            ✓ Active plan
          </span>
        ) : (
          <button
            type="button"
            className="btn-ghost min-h-11 px-4 text-sm"
            onClick={() => activate.mutate(plan.id)}
            disabled={activate.isPending}
          >
            Make this my active plan
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-slate-500">Week starts</span>
          <select
            className="input min-h-11 w-auto py-0"
            value={weekStart}
            onChange={(e) => updateSettings.mutate({ weekStartDay: Number(e.target.value) })}
          >
            {weekdayNames.map((n, i) => (
              <option key={n} value={i}>
                {n.slice(0, 3)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className="space-y-2">
        {shown.map((day) => {
          const open = openDay === day.dayIndex;
          const hasErrors = Object.keys(dayErrors(day.dayIndex)).length > 0;
          return (
            <li key={day.dayIndex} className={`card p-0 ${hasErrors ? 'ring-2 ring-red-500' : ''}`}>
              <button
                type="button"
                className="flex min-h-16 w-full items-center gap-3 px-4 text-left"
                aria-expanded={open}
                onClick={() => setOpenDay(open ? null : day.dayIndex)}
              >
                <span className="w-10 shrink-0 text-sm font-bold text-slate-500 uppercase">
                  {weekdayNames[day.dayIndex].slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {day.type === 'rest' ? 'Rest day' : day.label || 'Training'}
                  </span>
                  {day.type === 'train' && (
                    <span className="block truncate text-sm text-slate-500">
                      {day.items.length} exercises
                      {gripSummary(day, byId)}
                    </span>
                  )}
                </span>
                {day.intensity && <IntensityChip value={day.intensity} />}
                <span aria-hidden className="text-slate-400">
                  {open ? '▾' : '▸'}
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4">
                  <DayEditor
                    day={day}
                    dayOrder={dayOrder}
                    exercises={sortedExercises}
                    errors={dayErrors(day.dayIndex)}
                    onChange={updateDay}
                    onCopyTo={(to) => copyDay(day, to)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={onDuplicate}
          disabled={duplicate.isPending}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="btn-ghost text-red-600"
          onClick={onDelete}
          disabled={del.isPending}
        >
          Delete plan
        </button>
      </div>

      {/* Sticky save bar above the tab bar */}
      {(dirty || message) && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4 pb-3">
          <div className="mx-auto max-w-xl space-y-2">
            {message && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700 shadow dark:bg-red-950 dark:text-red-300"
              >
                {message}
              </p>
            )}
            {dirty && (
              <button
                type="button"
                className="btn-primary w-full shadow-lg"
                onClick={onSave}
                disabled={save.isPending}
              >
                {save.isPending ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function gripSummary(day: DraftDay, byId: Map<string, Exercise>): string {
  const grips = day.items
    .map((i) => byId.get(i.exerciseId)?.variations.find((v) => v.key === i.variationKey)?.name)
    .filter(Boolean);
  // Lat pulldown + cable row grips are what differ day to day.
  const machineGrips = day.items
    .filter((i) => byId.get(i.exerciseId)?.equipment === 'machine' && i.variationKey)
    .map((i) => byId.get(i.exerciseId)!.variations.find((v) => v.key === i.variationKey)?.name)
    .filter(Boolean);
  const show = machineGrips.length ? machineGrips : grips;
  return show.length ? ` · ${[...new Set(show)].slice(0, 2).join(' / ')}` : '';
}
