import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { DayStatus } from '../../shared/progress';
import { weekdayNames } from '../../shared/schemas';
import { kgToDisplay, weekdayOf } from '../../shared/time';
import { useMe } from '../api/auth';
import { useExercises } from '../api/exercises';
import { useProgressSummary, useSessionHistory } from '../api/progress';
import { formatDuration } from '../workout/session';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'exercises', label: 'Exercises' },
] as const;
type Tab = (typeof tabs)[number]['id'];

export default function ProgressPage() {
  const [params, setParams] = useSearchParams();
  const tab = (tabs.find((t) => t.id === params.get('tab'))?.id ?? 'overview') as Tab;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Progress</h1>
      <div
        className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800"
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`min-h-11 rounded-lg text-sm font-semibold ${
              tab === t.id
                ? 'bg-white shadow dark:bg-slate-950'
                : 'text-slate-600 dark:text-slate-400'
            }`}
            onClick={() => setParams(t.id === 'overview' ? {} : { tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'history' && <History />}
      {tab === 'exercises' && <ExerciseList />}
    </section>
  );
}

// ---------- Overview ----------

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const statusStyle: Record<DayStatus, { cls: string; mark: string; label: string; text?: string }> =
  {
    trained: { cls: 'bg-emerald-700 text-white', mark: '✓', label: 'Trained', text: 'Training' },
    missed: {
      cls: 'bg-red-50 text-red-700 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
      mark: '✕',
      label: 'Missed',
      text: 'Missed',
    },
    rest: {
      cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      mark: '·',
      label: 'Rest',
      text: 'Rest',
    },
    planned: {
      cls: 'border border-dashed border-slate-400 text-slate-600 dark:text-slate-300',
      mark: '',
      label: 'Planned',
    },
    none: { cls: 'text-slate-500', mark: '', label: '' },
  };

function Overview() {
  const [month, setMonth] = useState<string | null>(null);
  const { data, isPending, isError } = useProgressSummary(month);
  const { data: me } = useMe();
  const weekStart = me?.settings.weekStartDay ?? 6;

  if (isPending) return <p className="text-slate-500">Loading…</p>;
  if (isError || !data) return <p className="text-red-600">Couldn't load progress.</p>;

  const shown = data.month;
  const isCurrent = shown === data.today.slice(0, 7);
  const dates = Object.keys(data.days).sort();
  const lead = (weekdayOf(dates[0]) - weekStart + 7) % 7;
  const headers = Array.from({ length: 7 }, (_, i) =>
    weekdayNames[(weekStart + i) % 7].slice(0, 2),
  );
  const monthName = new Date(`${shown}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Current streak" value={`${data.streak.current}`} unit="days" />
        <Stat label="Best streak" value={`${data.streak.best}`} unit="days" />
        <Stat label="This week" value={`${data.week.done}/${data.week.planned}`} unit="workouts" />
        <Stat label="Total" value={`${data.totalWorkouts}`} unit="workouts" />
      </dl>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="btn-ghost min-h-11 px-4"
            onClick={() => setMonth(shiftMonth(shown, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className="font-semibold">{monthName}</h2>
          <button
            type="button"
            className="btn-ghost min-h-11 px-4"
            onClick={() => setMonth(shiftMonth(shown, 1))}
            disabled={isCurrent}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div
          className="grid grid-cols-7 gap-1 text-center"
          role="grid"
          aria-label={`Calendar, ${monthName}`}
        >
          {headers.map((h) => (
            <div key={h} className="pb-1 text-xs font-semibold text-slate-500" role="columnheader">
              {h}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`pad${i}`} />
          ))}
          {dates.map((d) => {
            const st = statusStyle[data.days[d]];
            const isToday = d === data.today;
            return (
              <div
                key={d}
                role="gridcell"
                aria-label={`${d}${st.label ? `: ${st.label}` : ''}${isToday ? ', today' : ''}`}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg text-sm ${st.cls} ${
                  isToday ? 'font-bold outline-2 outline-offset-1 outline-emerald-500' : ''
                }`}
              >
                <span>{Number(d.slice(8))}</span>
                {st.text && (
                  <span
                    aria-hidden
                    className="max-w-full truncate px-0.5 text-[8px] leading-none font-medium sm:text-[10px]"
                  >
                    {st.text}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {(['trained', 'missed', 'rest', 'planned'] as const).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`grid size-4 place-items-center rounded text-[9px] ${statusStyle[k].cls}`}
              >
                {statusStyle[k].mark}
              </span>
              {statusStyle[k].label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          Rest and missed days follow your current active plan. Days before your first workout
          aren't counted.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="card">
      <dt className="text-xs font-semibold text-slate-500 uppercase">{label}</dt>
      <dd className="mt-1">
        <span className="text-3xl font-bold tabular-nums">{value}</span>
        <span className="ml-1 text-sm text-slate-500">{unit}</span>
      </dd>
    </div>
  );
}

// ---------- History ----------

function History() {
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSessionHistory();
  const { data: me } = useMe();
  const units = me?.settings.units ?? 'kg';

  if (isPending) return <p className="text-slate-500">Loading…</p>;
  if (isError || !data) return <p className="text-red-600">Couldn't load history.</p>;
  const sessions = data.pages.flatMap((p) => p.sessions);
  if (sessions.length === 0)
    return (
      <div className="card text-center text-slate-500">
        No workouts yet. Finish your first one on the Today tab.
      </div>
    );

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {sessions.map((s) => {
          const dur = s.finishedAt
            ? formatDuration(new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime())
            : null;
          return (
            <li key={s.id}>
              <Link to={`/progress/session/${s.id}`} className="card flex items-center gap-3">
                <div className="w-12 shrink-0 text-center">
                  <p className="text-xs text-slate-500 uppercase">
                    {weekdayNames[weekdayOf(s.date)].slice(0, 3)}
                  </p>
                  <p className="text-xl font-bold">{Number(s.date.slice(8))}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {s.date}
                    {!s.finishedAt && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        not finished
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    {s.doneSets}/{s.totalSets} sets
                    {dur && ` · ${dur}`}
                    {s.volumeKg > 0 &&
                      ` · ${Math.round(kgToDisplay(s.volumeKg, units)).toLocaleString()} ${units}`}
                  </p>
                </div>
                <span aria-hidden className="text-slate-400">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load older workouts'}
        </button>
      )}
    </div>
  );
}

// ---------- Exercises ----------

function ExerciseList() {
  const { data, isPending } = useExercises();
  if (isPending) return <p className="text-slate-500">Loading…</p>;
  const list = (data ?? []).filter((e) => e.category !== 'mobility' && e.name !== 'Warm-up');
  return (
    <ul className="space-y-2">
      {list.map((e) => (
        <li key={e.id}>
          <Link
            to={`/progress/exercise/${e.id}`}
            className="card flex items-center justify-between"
          >
            <span className="font-medium">{e.name}</span>
            <span aria-hidden className="text-slate-400">
              📈 ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
