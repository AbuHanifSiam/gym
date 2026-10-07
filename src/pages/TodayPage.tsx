import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  orderedDays,
  weekdayNames,
  type TodayResponse,
  type WorkoutSession,
} from '../../shared/schemas';
import { kgToDisplay } from '../../shared/time';
import { useMe } from '../api/auth';
import { useToday } from '../api/today';
import ExerciseCard from '../components/today/ExerciseCard';
import IntensityChip from '../components/IntensityChip';
import { startRest, stopRest } from '../workout/restTimer';
import {
  addSet,
  buildSession,
  completeSet,
  formatDuration,
  isLastOpenSet,
  patchSet,
  removeLastSet,
  sessionStats,
  setVariation,
} from '../workout/session';
import {
  deleteSession,
  preferLocal,
  rememberServerSession,
  saveSession,
  useSyncStatus,
} from '../workout/sync';

export default function TodayPage() {
  const [picked, setPicked] = useState<number | null>(null);
  const { data, isPending, isError, refetch } = useToday(picked);
  const { data: me } = useMe();

  if (isPending) return <p className="pt-8 text-center text-slate-500">Loading today's workout…</p>;
  if (isError || !data)
    return (
      <div className="card mt-8 space-y-3 text-center">
        <p>Couldn't load today's workout.</p>
        <button type="button" className="btn-primary w-full" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );

  const t = data.data;
  const weekStart = me?.settings.weekStartDay ?? 6;

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-slate-500">
          {weekdayNames[t.todayIndex]}, {t.date}
          {data.offline && ' · offline copy'}
        </p>
        <h1 className="text-2xl font-bold">
          {t.dayIndex === t.todayIndex ? 'Today' : weekdayNames[t.dayIndex]}
          {t.day?.type === 'train' && t.day.label && (
            <span className="text-slate-500"> · {t.day.label}</span>
          )}
        </h1>
      </header>

      {t.plan && (
        <DayPicker
          days={orderedDays(t.plan.days, weekStart)}
          todayIndex={t.todayIndex}
          selected={t.dayIndex}
          onSelect={(d) => setPicked(d === t.todayIndex ? null : d)}
        />
      )}

      {!t.plan ? (
        <div className="card space-y-3 text-center">
          <p>You don't have an active plan.</p>
          <Link to="/plan" className="btn-primary w-full">
            Set up a plan
          </Link>
        </div>
      ) : (
        <Workout
          key={`${t.date}-${t.dayIndex}`}
          today={t}
          units={me?.settings.units ?? 'kg'}
          restDefault={me?.settings.restTimerDefault ?? 60}
          restHeavy={me?.settings.restTimerHeavy ?? 90}
        />
      )}
    </div>
  );
}

function DayPicker({
  days,
  todayIndex,
  selected,
  onSelect,
}: {
  days: NonNullable<TodayResponse['plan']>['days'];
  todayIndex: number;
  selected: number;
  onSelect: (dayIndex: number) => void;
}) {
  return (
    <div
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
      role="group"
      aria-label="Pick a day"
    >
      {days.map((d) => {
        const active = d.dayIndex === selected;
        return (
          <button
            key={d.dayIndex}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(d.dayIndex)}
            className={`relative flex min-h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl px-2 text-xs font-semibold ${
              active
                ? 'bg-emerald-700 text-white'
                : 'bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800'
            }`}
          >
            <span>{weekdayNames[d.dayIndex].slice(0, 3)}</span>
            <span
              className={`text-[10px] font-normal ${active ? 'text-white/80' : 'text-slate-500'}`}
            >
              {d.type === 'rest' ? 'rest' : d.intensity === 'hard' ? 'hard' : 'mod'}
            </span>
            {d.dayIndex === todayIndex && (
              <span
                className={`absolute top-1 right-1 size-1.5 rounded-full ${active ? 'bg-white' : 'bg-emerald-500'}`}
                aria-label="today"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Workout({
  today,
  units,
  restDefault,
  restHeavy,
}: {
  today: TodayResponse;
  units: 'kg' | 'lb';
  restDefault: number;
  restHeavy: number;
}) {
  const [session, setSession] = useState<WorkoutSession | null>(() => {
    if (today.session) rememberServerSession(today.session);
    return preferLocal(today.session, today.date, today.dayIndex);
  });
  const ref = useRef(session);
  const [openIdx, setOpenIdx] = useState<number | null>(() =>
    session ? firstOpenEntry(session) : null,
  );
  const exercises = new Map(today.exercises.map((e) => [e.id, e]));
  const listRef = useRef<HTMLOListElement>(null);

  function commit(next: WorkoutSession | null) {
    if (next) {
      next = { ...next, rev: (ref.current?.rev ?? 0) + 1, updatedAt: new Date().toISOString() };
      saveSession(next);
    }
    ref.current = next;
    setSession(next);
  }

  // Scroll the newly opened exercise into view.
  useEffect(() => {
    if (openIdx == null) return;
    const el = listRef.current?.children[openIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [openIdx]);

  if (!session) {
    if (!today.day || today.day.type === 'rest') return <RestDay />;
    const day = today.day;
    return (
      <div className="space-y-4">
        {day.intensity && (
          <div className="flex items-center gap-2 text-sm">
            <IntensityChip value={day.intensity} />
            <span className="text-slate-500">
              {day.intensity === 'hard'
                ? 'Heavier weight: last 2 reps tough but clean.'
                : 'About 70% of your hard-day weight.'}
            </span>
          </div>
        )}
        <ol className="card space-y-1.5">
          {day.items.map((item, i) => {
            const ex = exercises.get(item.exerciseId);
            const grip = ex?.variations.find((v) => v.key === item.variationKey);
            return (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-5 shrink-0 text-right text-slate-500">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  {ex?.name ?? 'Unknown'}
                  {grip && (
                    <span className="text-emerald-700 dark:text-emerald-400"> · {grip.name}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="btn-primary min-h-16 w-full text-lg"
          disabled={day.items.length === 0}
          onClick={() => {
            const s = buildSession({ planId: today.plan?.id ?? null, date: today.date, day });
            commit({ ...s, rev: 0 });
            setOpenIdx(0);
          }}
        >
          Start workout
        </button>
      </div>
    );
  }

  const stats = sessionStats(session);
  const finished = session.finishedAt != null;
  const pct = stats.totalSets ? Math.round((stats.doneSets / stats.totalSets) * 100) : 0;

  function toggleSet(ei: number, si: number) {
    const s = ref.current!;
    const set = s.entries[ei].sets[si];
    const ex = exercises.get(s.entries[ei].exerciseId);
    const timed = ex?.measure === 'time' || s.entries[ei].target.durationSec != null;
    if (set.done) {
      commit(patchSet(s, ei, si, { done: false }));
      return;
    }
    const lastOne = isLastOpenSet(s, ei, si);
    const next = completeSet(s, ei, si, today.last[s.entries[ei].exerciseId], timed);
    commit(next);
    if (!finished && !lastOne) startRest(ex?.heavyRest ? restHeavy : restDefault);
    if (lastOne) stopRest();
    // Exercise complete: move on to the next unfinished one.
    const entry = next.entries[ei];
    if (entry.sets.every((x) => x.done)) setOpenIdx(firstOpenEntry(next, ei));
  }

  function finish() {
    const left = stats.totalSets - stats.doneSets;
    if (left > 0 && !confirm(`${left} set${left > 1 ? 's' : ''} not done. Finish anyway?`)) return;
    stopRest();
    commit({ ...ref.current!, finishedAt: new Date().toISOString() });
    setOpenIdx(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function discard() {
    if (!confirm('Discard this workout? Everything you logged in it will be deleted.')) return;
    stopRest();
    deleteSession(ref.current!.id);
    ref.current = null;
    setSession(null);
  }

  return (
    <div className="space-y-4">
      {finished ? (
        <Summary session={session} units={units} />
      ) : (
        <div className="card space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">
              {stats.doneSets}/{stats.totalSets} sets · {stats.doneExercises}/
              {session.entries.length} exercises
            </span>
            <Elapsed from={session.startedAt} />
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Workout progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <SyncBadge />
        </div>
      )}

      <ol ref={listRef} className="space-y-2">
        {session.entries.map((entry, ei) => (
          <ExerciseCard
            key={ei}
            index={ei}
            entry={entry}
            exercise={exercises.get(entry.exerciseId)}
            last={today.last[entry.exerciseId]}
            units={units}
            open={openIdx === ei}
            onToggleOpen={() => setOpenIdx(openIdx === ei ? null : ei)}
            onSetChange={(si, patch) => commit(patchSet(ref.current!, ei, si, patch))}
            onSetToggle={(si) => toggleSet(ei, si)}
            onAddSet={() => commit(addSet(ref.current!, ei))}
            onRemoveSet={() => commit(removeLastSet(ref.current!, ei))}
            onVariation={(key) => commit(setVariation(ref.current!, ei, key))}
          />
        ))}
      </ol>

      {!finished && (
        <button type="button" className="btn-primary min-h-16 w-full text-lg" onClick={finish}>
          Finish workout
        </button>
      )}
      {finished && (
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => commit({ ...ref.current!, finishedAt: null })}
        >
          Reopen workout
        </button>
      )}
      <button
        type="button"
        className="mx-auto block min-h-11 text-sm text-red-600 underline-offset-4 hover:underline"
        onClick={discard}
      >
        Discard workout
      </button>
    </div>
  );
}

function firstOpenEntry(s: WorkoutSession, after = -1): number | null {
  const n = s.entries.length;
  for (let k = 1; k <= n; k++) {
    const i = (after + k) % n;
    if (s.entries[i].sets.some((x) => !x.done)) return i;
  }
  return null;
}

function Elapsed({ from }: { from: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-lg font-bold tabular-nums" aria-label="Workout duration">
      {formatDuration(now - new Date(from).getTime())}
    </span>
  );
}

function SyncBadge() {
  const status = useSyncStatus();
  const text = {
    idle: '',
    saving: 'Saving…',
    saved: '✓ Saved',
    offline: 'Offline · saved on this phone, will sync',
    error: 'Not synced yet · will retry',
  }[status];
  if (!text) return null;
  return (
    <p
      className={`text-xs ${status === 'offline' || status === 'error' ? 'text-amber-600' : 'text-slate-500'}`}
      role="status"
    >
      {text}
    </p>
  );
}

function Summary({ session, units }: { session: WorkoutSession; units: 'kg' | 'lb' }) {
  const stats = sessionStats(session);
  const duration = new Date(session.finishedAt!).getTime() - new Date(session.startedAt).getTime();
  return (
    <div className="card space-y-3 bg-emerald-700 text-white ring-0 dark:bg-emerald-700">
      <p className="text-xl font-bold">Workout done 💪</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-xs text-white/70 uppercase">Time</dt>
          <dd className="text-xl font-bold tabular-nums">{formatDuration(duration)}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/70 uppercase">Sets</dt>
          <dd className="text-xl font-bold tabular-nums">
            {stats.doneSets}/{stats.totalSets}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/70 uppercase">Volume</dt>
          <dd className="text-xl font-bold tabular-nums">
            {Math.round(kgToDisplay(stats.volumeKg, units)).toLocaleString()}
            <span className="text-sm font-normal"> {units}</span>
          </dd>
        </div>
      </dl>
      <SyncBadge />
    </div>
  );
}

function RestDay() {
  return (
    <div className="card space-y-3">
      <p className="text-xl font-bold">Rest day 🌿</p>
      <p className="text-slate-600 dark:text-slate-300">
        Recovery is when your muscles grow. Keep it light today:
      </p>
      <ul className="space-y-2">
        <li>🚶 Walk 20–30 minutes</li>
        <li>🧘 Stretch for 5–10 minutes</li>
        <li>😴 Sleep 7–9 hours</li>
        <li>💧 Drink plenty of water</li>
      </ul>
      <p className="text-sm text-slate-500">
        Missed a workout? Pick another day above to do it today.
      </p>
    </div>
  );
}
